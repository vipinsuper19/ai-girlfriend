package com.dhama.mybase.core.data

import com.dhama.mybase.core.chat.ChatStreamEvent
import com.dhama.mybase.core.chat.StreamRecovery
import com.dhama.mybase.core.chat.chunkReply
import com.dhama.mybase.core.chat.droppedStreamLine
import com.dhama.mybase.core.chat.DROPPED_DELIVERY
import com.dhama.mybase.core.chat.MESSAGE_PAGE
import com.dhama.mybase.core.chat.endsWithUserMessage
import com.dhama.mybase.core.chat.idleStallDelivery
import com.dhama.mybase.core.chat.keptOnReload
import com.dhama.mybase.core.chat.localReply
import com.dhama.mybase.core.chat.replyFailureDelivery
import com.dhama.mybase.core.chat.streamRecovery
import com.dhama.mybase.core.db.dao.ChatMessageDao
import com.dhama.mybase.core.db.entity.ChatMessageEntity
import com.dhama.mybase.core.domain.ChatRepository
import com.dhama.mybase.core.network.ApiClient
import com.dhama.mybase.core.network.ApiStatusException
import com.dhama.mybase.core.network.LastUserReplyApi
import com.dhama.mybase.core.network.RemoteMessage
import com.dhama.mybase.core.network.RemoteSendFailure
import com.dhama.mybase.core.network.STALLED_STREAM
import com.dhama.mybase.core.network.StreamIdleException
import com.dhama.mybase.core.network.remoteSendFailure
import com.dhama.mybase.core.network.serverLocalId
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
    private val lastUserReply: LastUserReplyApi = api,
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
        clientMessageId: String?,
    ) {
        val body = text.trim()
        if (body.isEmpty()) return
        val messageId = clientMessageId?.takeIf { it.isNotBlank() } ?: UUID.randomUUID().toString()
        if (conversationId != null) {
            sendRemote(body, conversationId, messageId)
            return
        }
        val now = System.currentTimeMillis()
        dao.upsert(
            ChatMessageEntity(
                id = messageId,
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

    private suspend fun sendRemote(text: String, conversationId: Int, clientMessageId: String) {
        val now = System.currentTimeMillis()
        val userLocalId = clientMessageId
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
            api.streamMessage(conversationId, text, clientMessageId) { event ->
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
                        storeFinishedReply(assistantId, event.serverMessageId, finalText, now + 1)
                    }
                    is ChatStreamEvent.Error -> throw ApiStatusException(
                        0,
                        event.message,
                        event.code,
                        event.retryAfterSeconds,
                    )
                    is ChatStreamEvent.UserMessage -> userAccepted = true
                }
            }
            when (streamRecovery(userAccepted, built.isNotEmpty(), finished)) {
                StreamRecovery.Finished -> Unit
                StreamRecovery.Fallback -> deliverBlocking(
                    conversationId,
                    text,
                    userLocalId,
                    assistantId,
                    now,
                    clientMessageId,
                )
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
        } catch (error: StreamIdleException) {
            markReplyFailed(
                assistantId,
                built.toString(),
                now,
                error.message ?: STALLED_STREAM,
                idleStallDelivery(userAccepted, built.isNotEmpty()),
            )
        } catch (error: Exception) {
            if (isUsageLimit(error)) {
                dao.delete(assistantId)
                dao.delete(userLocalId)
                throw error
            }
            if (isRateLimited(error)) {
                markReplyFailed(
                    assistantId,
                    built.toString(),
                    now,
                    error.message ?: "Too many requests. Try again later.",
                    "FAILED",
                )
                throw error
            }
            if (streamRecovery(userAccepted, built.isNotEmpty(), finished) == StreamRecovery.Fallback) {
                try {
                    deliverBlocking(conversationId, text, userLocalId, assistantId, now, clientMessageId)
                } catch (cancelled: CancellationException) {
                    dao.delete(assistantId)
                    throw cancelled
                } catch (fallback: Exception) {
                    if (isUsageLimit(fallback)) {
                        dao.delete(assistantId)
                        dao.delete(userLocalId)
                        throw fallback
                    }
                    if (isRateLimited(fallback)) {
                        markReplyFailed(
                            assistantId,
                            "",
                            now,
                            fallback.message ?: "Too many requests. Try again later.",
                            "FAILED",
                        )
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
        return error is ApiStatusException &&
            remoteSendFailure(error.status, error.code) == RemoteSendFailure.UsageLimit
    }

    private fun isRateLimited(error: Throwable): Boolean {
        return error is ApiStatusException &&
            remoteSendFailure(error.status, error.code) == RemoteSendFailure.RateLimited
    }

    private suspend fun storeFinishedReply(
        placeholderId: String,
        serverMessageId: Int?,
        text: String,
        createdAtEpochMs: Long,
    ) {
        val id = serverMessageId?.let { serverLocalId(it) } ?: placeholderId
        if (id != placeholderId) dao.delete(placeholderId)
        dao.upsert(
            ChatMessageEntity(
                id = id,
                role = ROLE_ASSISTANT,
                text = text,
                createdAtEpochMs = createdAtEpochMs,
                delivery = DELIVERY_SENT,
            ),
        )
    }

    private suspend fun deliverBlocking(
        conversationId: Int,
        text: String,
        userLocalId: String,
        assistantId: String,
        now: Long,
        clientMessageId: String,
    ) {
        val posted = api.postMessage(conversationId, text, clientMessageId)
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

    override suspend fun retryUnfinishedReply(conversationId: Int) {
        reload(conversationId)
        val ordered = orderedThread()
        if (!endsWithUserMessage(ordered.map { it.role }, ordered.map { it.kind })) return
        val user = ordered.last { it.kind != ChatMessageEntity.KIND_SYSTEM }
        if (user.role != ROLE_USER) return
        streamLastUserReply(conversationId, user)
    }

    override suspend fun retryUnsent(
        text: String,
        name: String,
        relationship: String,
        traits: List<String>,
        conversationId: Int?,
        clientMessageId: String,
        failedLocalId: String,
    ) {
        if (failedLocalId != clientMessageId) discard(failedLocalId)
        send(text, name, relationship, traits, conversationId, clientMessageId)
    }

    private suspend fun streamLastUserReply(conversationId: Int, user: ChatMessageEntity) {
        val userMessageId = serverRecordId(user.id) ?: return
        val assistantId = UUID.randomUUID().toString()
        val userAt = user.createdAtEpochMs
        val built = StringBuilder()
        var finished = false
        dao.upsert(
            ChatMessageEntity(
                id = assistantId,
                role = ROLE_ASSISTANT,
                text = "",
                createdAtEpochMs = userAt + 1,
                delivery = DELIVERY_STREAMING,
            ),
        )
        try {
            lastUserReply.replyToLastUserMessage(conversationId, userMessageId) { event ->
                when (event) {
                    is ChatStreamEvent.Delta -> {
                        built.append(event.content)
                        dao.upsert(
                            ChatMessageEntity(
                                id = assistantId,
                                role = ROLE_ASSISTANT,
                                text = built.toString(),
                                createdAtEpochMs = userAt + 1,
                                delivery = DELIVERY_STREAMING,
                            ),
                        )
                    }
                    is ChatStreamEvent.Done -> {
                        val finalText = event.content.ifBlank { built.toString() }
                        built.clear()
                        built.append(finalText)
                        finished = true
                        storeFinishedReply(assistantId, event.serverMessageId, finalText, userAt + 1)
                    }
                    is ChatStreamEvent.Error -> throw ApiStatusException(
                        0,
                        event.message,
                        event.code,
                        event.retryAfterSeconds,
                    )
                    is ChatStreamEvent.UserMessage -> Unit
                }
            }
            if (!finished) {
                markReplyFailed(assistantId, built.toString(), userAt, "Something went wrong.", DELIVERY_DROPPED)
            }
        } catch (error: CancellationException) {
            dao.delete(assistantId)
            throw error
        } catch (error: StreamIdleException) {
            markReplyFailed(
                assistantId,
                built.toString(),
                userAt,
                error.message ?: STALLED_STREAM,
                DELIVERY_DROPPED,
            )
        } catch (error: ApiStatusException) {
            dao.delete(assistantId)
            when (remoteSendFailure(error.status, error.code)) {
                RemoteSendFailure.UsageLimit -> throw error
                RemoteSendFailure.RateLimited -> {
                    markReplyFailed(
                        assistantId,
                        "",
                        userAt,
                        error.message ?: "Too many requests. Try again later.",
                        DELIVERY_DROPPED,
                    )
                    throw error
                }
                RemoteSendFailure.NotLatest -> reload(conversationId)
                RemoteSendFailure.Missing -> {
                    reload(conversationId)
                    throw error
                }
                RemoteSendFailure.Other -> markReplyFailed(
                    assistantId,
                    built.toString(),
                    userAt,
                    error.message ?: "Something went wrong.",
                    DELIVERY_DROPPED,
                )
            }
        } catch (error: Exception) {
            markReplyFailed(
                assistantId,
                built.toString(),
                userAt,
                error.message ?: "Something went wrong.",
                DELIVERY_DROPPED,
            )
        }
    }

    private suspend fun orderedThread(): List<ChatMessageEntity> {
        return dao.snapshot().sortedWith(
            compareBy<ChatMessageEntity> { it.createdAtEpochMs }
                .thenBy { serverRecordId(it.id) ?: Int.MAX_VALUE },
        )
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

    override suspend fun regenerate(id: String) {
        val serverId = serverRecordId(id)
            ?: throw ApiStatusException(400, "Only her replies on the server can be regenerated.", null)
        val current = dao.find(id)
        val reply = api.regenerate(serverId).assistantMessage
            ?: throw ApiStatusException(0, "Couldn't regenerate that.", null)
        val stored = reply.toStored(api.origin())
        dao.delete(id)
        dao.upsert(
            stored.copy(
                createdAtEpochMs = stored.createdAtEpochMs.takeIf { it > 0L }
                    ?: current?.createdAtEpochMs
                    ?: System.currentTimeMillis(),
            ),
        )
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
