package com.dhama.mybase.core.domain

import com.dhama.mybase.core.db.entity.ChatMessageEntity
import kotlinx.coroutines.flow.Flow

interface ChatRepository {
    fun observe(): Flow<List<ChatMessageEntity>>
    suspend fun ensureGreeting(greeting: String)
    suspend fun send(
        text: String,
        name: String,
        relationship: String,
        traits: List<String>,
        conversationId: Int? = null,
    )
    suspend fun sendVoice(path: String, durationMs: Long, conversationId: Int? = null)
    suspend fun delete(id: String)
    suspend fun discard(id: String)
    suspend fun clear()
}
