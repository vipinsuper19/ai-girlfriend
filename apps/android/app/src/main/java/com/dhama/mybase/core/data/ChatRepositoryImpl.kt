package com.dhama.mybase.core.data

import com.dhama.mybase.core.chat.ChatStreamEvent
import com.dhama.mybase.core.chat.chunkReply
import com.dhama.mybase.core.chat.localReply
import com.dhama.mybase.core.db.dao.ChatMessageDao
import com.dhama.mybase.core.db.entity.ChatMessageEntity
import com.dhama.mybase.core.domain.ChatRepository
import com.dhama.mybase.core.network.ApiClient
import com.dhama.mybase.core.network.ApiStatusException
import com.dhama.mybase.core.network.serverRecordId
import com.dhama.mybase.core.voice.resolveVoiceUrl
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
        dao.upsert(
            ChatMessageEntity(
                id = UUID.randomUUID().toString(),
                role = ROLE_USER,
                text = text,
                createdAtEpochMs = now,
                delivery = DELIVERY_SENT,
            ),
        )
        val assistantId = UUID.randomUUID().toString()
        val built = StringBuilder()
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
                    is ChatStreamEvent.UserMessage -> Unit
                }
            }
            if (!finished) {
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
        } catch (error: CancellationException) {
            dao.delete(assistantId)
            throw error
        } catch (error: Exception) {
            dao.upsert(
                ChatMessageEntity(
                    id = assistantId,
                    role = ROLE_ASSISTANT,
                    text = built.toString().ifBlank { error.message ?: "Something went wrong." },
                    createdAtEpochMs = now + 1,
                    delivery = DELIVERY_FAILED,
                ),
            )
        }
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
        } catch (_: Exception) {
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
    }
}
