package com.dhama.mybase.core.data

import com.dhama.mybase.core.chat.ChatStreamEvent
import com.dhama.mybase.core.chat.StreamRecovery
import com.dhama.mybase.core.chat.chunkReply
import com.dhama.mybase.core.chat.droppedStreamLine
import com.dhama.mybase.core.chat.DROPPED_DELIVERY
import com.dhama.mybase.core.chat.MESSAGE_PAGE
import com.dhama.mybase.core.chat.keptOnReload
import com.dhama.mybase.core.chat.localReply
import com.dhama.mybase.core.chat.replyFailureDelivery
import com.dhama.mybase.core.chat.streamRecovery
import com.dhama.mybase.core.db.dao.ChatMessageDao
import com.dhama.mybase.core.db.entity.ChatMessageEntity
import com.dhama.mybase.core.domain.ChatRepository
import com.dhama.mybase.core.network.ApiClient
import com.dhama.mybase.core.network.ApiStatusException
import com.dhama.mybase.core.network.RemoteMessage
import com.dhama.mybase.core.network.serverRecordId
import com.dhama.mybase.core.network.toRestored
import com.dhama.mybase.core.voice.resolveVoiceUrl
import com.dhama.mybase.core.voice.speakBlockReason
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import java.io.File
import java.util.UUID
import kotlin.coroutines.cancellation.CancellationException
import kotlin.coroutines.coroutineContext

class ChatRepositoryImpl(
    private val dao: ChatMessageDao,
    private val voiceDir: File,
    private val api: ApiClient,
) : ChatRepository {

    override fun observe(): Flow<List<ChatMessageEntity>> = dao.observe()

    override suspend fun ensureGreeting(greeting: String) {
        if (greeting.isBlank() || dao.count() > 0) return
        dao.upsert(
            ChatMessageEntity(
                id = GREETING_ID,
                role = ROLE_ASSISTANT,
                text = greeting,
                createdAtEpochMs = System.currentTimeMillis(),
                delivery = DELIVERY_SENT,
            ),
        )
    }

    override suspend fun send(
        text: String,
        name: String,
        relationship: String,
        traits: List<String>,
        conversationId: Int?,
    ) {
        val body = text.trim()
        if (body.isEmpty()) return
        if (conversationId != null) {
            sendRemote(body, conversationId)
            return
        }
        val now = System.currentTimeMillis()
        dao.upsert(
            ChatMessageEntity(
                id = UUID.randomUUID().toString(),
                role = ROLE_USER,
                text = body,
                createdAtEpochMs = now,
                delivery = DELIVERY_SENT,
            ),
        )
        val assistantId = UUID.randomUUID().toString()
        val built = StringBuilder()
        try {
            dao.upsert(
                ChatMessageEntity(
                    id = assistantId,
                    role = ROLE_ASSISTANT,
                    text = "",
                    createdAtEpochMs = now + 1,
                    delivery = DELIVERY_STREAMING,
                ),
            )
            val reply = localReply(name, relationship, traits, body)
            for (chunk in chunkReply(reply)) {
                coroutineContext.ensureActive()
                built.append(chunk)
                dao.upsert(
                    ChatMessageEntity(
                        id = assistantId,
                        role = ROLE_ASSISTANT,
                        text = built.toString(),
                        createdAtEpochMs = now + 1,
                        delivery = DELIVERY_STREAMING,
                    ),
                )
                delay(28)
            }
            dao.upsert(
                ChatMessageEntity(
                    id = assistantId,
                    role = ROLE_ASSISTANT,
                    text = built.toString(),
                    createdAtEpochMs = now + 1,
                    delivery = DELIVERY_SENT,
                ),
            )
        } catch (error: CancellationException) {
            dao.delete(assistantId)
            throw error
        } catch (_: Exception) {
            dao.upsert(
                ChatMessageEntity(
                    id = assistantId,
                    role = ROLE_ASSISTANT,
                    text = built.toString().ifBlank { "Something went wrong." },
                    createdAtEpochMs = now + 1,
                    delivery = DELIVERY_FAILED,
                ),
            )
        }
    }

    override suspend fun sendVoice(path: String, durationMs: Long, conversationId: Int?) {
        if (path.isBlank()) return
        if (conversationId != null) {
            sendVoiceRemote(path, durationMs, conversationId)
            return
        }
        dao.upsert(
            ChatMessageEntity(
                id = UUID.randomUUID().toString(),
                role = ROLE_USER,
                text = "",
                createdAtEpochMs = System.currentTimeMillis(),
                delivery = DELIVERY_SENT,
                kind = ChatMessageEntity.KIND_AUDIO,
                audioPath = path,
                durationMs = durationMs.coerceAtLeast(0),
            ),
        )
    }

    private suspend fun sendRemote(text: String, conversationId: Int) {
        val now = System.currentTimeMillis()
        val userLocalId = UUID.randomUUID().toString()
        dao.upsert(
            ChatMessageEntity(
                id = userLocalId,
                role = ROLE_USER,
                text = text,
                createdAtEpochMs = now,
                delivery = DELIVERY_SENT,
            ),
        )
        val assistantId = UUID.randomUUID().toString()
        val built = StringBuilder()
        var userAccepted = false
        var finished = false
        try {
            dao.upsert(
                ChatMessageEntity(
                    id = assistantId,
                    role = ROLE_ASSISTANT,
                    text = "",
                    createdAtEpochMs = now + 1,
                    delivery = DELIVERY_STREAMING,
                ),
            )
            api.streamMessage(conversationId, text) { event ->
                when (event) {
                    is ChatStreamEvent.Delta -> {
                        userAccepted = true
                        built.append(event.content)
                        dao.upsert(
                            ChatMessageEntity(
                                id = assistantId,
                                role = ROLE_ASSISTANT,
                                text = built.toString(),
                                createdAtEpochMs = now + 1,
                                delivery = DELIVERY_STREAMING,
                            ),
                        )
                    }
                    is ChatStreamEvent.Done -> {
                        val finalText = event.content.ifBlank { built.toString() }
                        built.clear()
                        built.append(finalText)
                        finished = true
                        dao.upsert(
                            ChatMessageEntity(
                                id = assistantId,
                                role = ROLE_ASSISTANT,
                                text = finalText,
                                createdAtEpochMs = now + 1,
                                delivery = DELIVERY_SENT,
                            ),
                        )
                    }
                    is ChatStreamEvent.Error -> throw ApiStatusException(0, event.message, null)
                    is ChatStreamEvent.UserMessage -> userAccepted = true
                }
            }
            when (streamRecovery(userAccepted, built.isNotEmpty(), finished)) {
                StreamRecovery.Finished -> Unit
                StreamRecovery.Fallback -> deliverBlocking(conversationId, text, userLocalId, assistantId, now)
                StreamRecovery.Failed -> markReplyFailed(
                    assistantId,
                    built.toString(),
                    now,
                    "Something went wrong.",
                    replyFailureDelivery(userAccepted, built.isNotEmpty(), finished),
                )
            }
        } catch (error: CancellationException) {
            dao.delete(assistantId)
            throw error
        } catch (error: Exception) {
            if (isUsageLimit(error)) {
                dao.delete(assistantId)
                dao.delete(userLocalId)
                throw error
            }
            if (streamRecovery(userAccepted, built.isNotEmpty(), finished) == StreamRecovery.Fallback) {
                try {
                    deliverBlocking(conversationId, text, userLocalId, assistantId, now)
                } catch (cancelled: CancellationException) {
                    dao.delete(assistantId)
                    throw cancelled
                } catch (fallback: Exception) {
                    if (isUsageLimit(fallback)) {
                        dao.delete(assistantId)
                        dao.delete(userLocalId)
                        throw fallback
                    }
                    markReplyFailed(
                        assistantId,
                        "",
                        now,
                        fallback.message ?: "Something went wrong.",
                        replyFailureDelivery(userAccepted, built.isNotEmpty(), finished),
                    )
                }
            } else {
                markReplyFailed(
                    assistantId,
                    built.toString(),
                    now,
                    error.message ?: "Something went wrong.",
                    replyFailureDelivery(userAccepted, built.isNotEmpty(), finished),
                )
            }
        }
    }

    private fun isUsageLimit(error: Throwable): Boolean {
        return error is ApiStatusException && error.code == "USAGE_LIMIT_EXCEEDED"
    }

    private suspend fun deliverBlocking(
        conversationId: Int,
        text: String,
        userLocalId: String,
        assistantId: String,
        now: Long,
    ) {
        val posted = api.postMessage(conversationId, text)
        val user = posted.userMessage?.toRestored(api.origin())
        val assistant = posted.assistantMessage?.toRestored(api.origin())
        if (user == null || assistant == null || assistant.text.isBlank()) {
            throw ApiStatusException(0, "Couldn't send that.", null)
        }
        val userAt = user.createdAtEpochMs.takeIf { it > 0L } ?: now
        val assistantAt = assistant.createdAtEpochMs.takeIf { it > userAt } ?: userAt + 1
        dao.delete(userLocalId)
        dao.delete(assistantId)
        dao.upsert(
            ChatMessageEntity(
                id = user.id,
                role = user.role,
                text = user.text.ifBlank { text },
                createdAtEpochMs = userAt,
                delivery = DELIVERY_SENT,
                kind = user.kind,
                audioPath = user.audioPath,
            ),
        )
        dao.upsert(
            ChatMessageEntity(
                id = assistant.id,
                role = assistant.role,
                text = assistant.text,
                createdAtEpochMs = assistantAt,
                delivery = DELIVERY_SENT,
                kind = assistant.kind,
                audioPath = assistant.audioPath,
            ),
        )
        dao.upsert(
            ChatMessageEntity(
                id = UUID.randomUUID().toString(),
                role = ROLE_SYSTEM,
                text = droppedStreamLine(),
                createdAtEpochMs = assistantAt + 1,
                delivery = DELIVERY_SENT,
                kind = ChatMessageEntity.KIND_SYSTEM,
            ),
        )
    }

    private suspend fun markReplyFailed(
        assistantId: String,
        text: String,
        now: Long,
        fallback: String,
        delivery: String,
    ) {
        dao.upsert(
            ChatMessageEntity(
                id = assistantId,
                role = ROLE_ASSISTANT,
                text = text.ifBlank { fallback },
                createdAtEpochMs = now + 1,
                delivery = delivery,
            ),
        )
    }

    override suspend fun reload(conversationId: Int) {
        val remote = api.listMessages(conversationId, limit = MESSAGE_PAGE)
        val snapshot = dao.snapshot()
        snapshot
            .filter { message ->
                !keptOnReload(message.delivery, message.kind) && serverRecordId(message.id) == null
            }
            .forEach { dao.delete(it.id) }
        remote.forEach { dao.upsert(it.toStored(api.origin())) }
    }

    override suspend fun loadOlder(conversationId: Int, beforeId: Int): Int {
        val remote = api.listMessages(conversationId, before = beforeId, limit = MESSAGE_PAGE)
        remote.forEach { dao.upsert(it.toStored(api.origin())) }
        return remote.size
    }

    private suspend fun sendVoiceRemote(path: String, durationMs: Long, conversationId: Int) {
        val now = System.currentTimeMillis()
        try {
            val turn = api.respondVoice(conversationId, File(path))
            dao.upsert(
                ChatMessageEntity(
                    id = UUID.randomUUID().toString(),
                    role = ROLE_USER,
                    text = turn.transcript,
                    createdAtEpochMs = now,
                    delivery = DELIVERY_SENT,
                    kind = ChatMessageEntity.KIND_AUDIO,
                    audioPath = path,
                    durationMs = durationMs.coerceAtLeast(0),
                ),
            )
            val spoken = turn.audio?.audioUrl?.takeIf { it.isNotBlank() }
                ?.let { resolveVoiceUrl(api.origin(), it) }
                .orEmpty()
            if (spoken.isNotBlank()) {
                dao.upsert(
                    ChatMessageEntity(
                        id = UUID.randomUUID().toString(),
                        role = ROLE_ASSISTANT,
                        text = turn.assistantMessage?.content.orEmpty(),
                        createdAtEpochMs = now + 1,
                        delivery = DELIVERY_SENT,
                        kind = ChatMessageEntity.KIND_AUDIO,
                        audioPath = spoken,
                        durationMs = 0,
                    ),
                )
            }
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            if (isUsageLimit(error)) throw error
            dao.upsert(
                ChatMessageEntity(
                    id = UUID.randomUUID().toString(),
                    role = ROLE_USER,
                    text = "",
                    createdAtEpochMs = now,
                    delivery = DELIVERY_FAILED,
                    kind = ChatMessageEntity.KIND_AUDIO,
                    audioPath = path,
                    durationMs = durationMs.coerceAtLeast(0),
                ),
            )
        }
    }

    override suspend fun speak(companionId: Int, text: String): String {
        val body = text.trim()
        val blocked = speakBlockReason(body, companionId)
        if (blocked != null) throw ApiStatusException(400, blocked, null)
        val url = api.synthesize(companionId, body)
        if (url.isBlank()) throw ApiStatusException(0, "Couldn't speak that.", null)
        return resolveVoiceUrl(api.origin(), url)
    }

    override suspend fun delete(id: String) {
        val serverId = serverRecordId(id)
        if (serverId != null && api.hasSession()) {
            api.deleteMessage(serverId)
        }
        dao.find(id)?.let { deleteAudio(it.audioPath) }
        dao.delete(id)
    }

    override suspend fun discard(id: String) {
        dao.delete(id)
    }

    override suspend fun note(text: String) {
        val body = text.trim()
        if (body.isEmpty()) return
        dao.upsert(
            ChatMessageEntity(
                id = UUID.randomUUID().toString(),
                role = ROLE_SYSTEM,
                text = body,
                createdAtEpochMs = System.currentTimeMillis(),
                delivery = DELIVERY_SENT,
                kind = ChatMessageEntity.KIND_SYSTEM,
            ),
        )
    }

    override suspend fun clear() {
        voiceDir.listFiles()?.forEach { it.delete() }
        dao.clear()
    }

    private fun RemoteMessage.toStored(origin: String): ChatMessageEntity {
        val restored = toRestored(origin)
        return ChatMessageEntity(
            id = restored.id,
            role = restored.role,
            text = restored.text,
            createdAtEpochMs = restored.createdAtEpochMs,
            delivery = DELIVERY_SENT,
            kind = restored.kind,
            audioPath = restored.audioPath,
        )
    }

    private fun deleteAudio(path: String) {
        if (path.isBlank() || path.startsWith("http://") || path.startsWith("https://")) return
        File(path).delete()
    }

    companion object {
        const val GREETING_ID = "greeting"
        const val ROLE_USER = "USER"
        const val ROLE_ASSISTANT = "ASSISTANT"
        const val ROLE_SYSTEM = "SYSTEM"
        const val DELIVERY_SENT = "SENT"
        const val DELIVERY_STREAMING = "STREAMING"
        const val DELIVERY_FAILED = "FAILED"
        const val DELIVERY_DROPPED = DROPPED_DELIVERY
    }
}
