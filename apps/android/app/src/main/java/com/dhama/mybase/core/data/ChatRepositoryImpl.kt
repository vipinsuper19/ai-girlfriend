package com.dhama.mybase.core.data

import com.dhama.mybase.core.chat.chunkReply
import com.dhama.mybase.core.chat.localReply
import com.dhama.mybase.core.db.dao.ChatMessageDao
import com.dhama.mybase.core.db.entity.ChatMessageEntity
import com.dhama.mybase.core.domain.ChatRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import java.util.UUID
import kotlin.coroutines.cancellation.CancellationException
import kotlin.coroutines.coroutineContext

class ChatRepositoryImpl(
    private val dao: ChatMessageDao,
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
    ) {
        val body = text.trim()
        if (body.isEmpty()) return
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

    override suspend fun delete(id: String) {
        dao.delete(id)
    }

    override suspend fun clear() {
        dao.clear()
    }

    companion object {
        const val GREETING_ID = "greeting"
        const val ROLE_USER = "USER"
        const val ROLE_ASSISTANT = "ASSISTANT"
        const val DELIVERY_SENT = "SENT"
        const val DELIVERY_STREAMING = "STREAMING"
        const val DELIVERY_FAILED = "FAILED"
    }
}
