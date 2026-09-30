package com.dhama.mybase.core.domain

import com.dhama.mybase.core.db.entity.ChatMessageEntity
import kotlinx.coroutines.flow.Flow

interface ChatRepository {
    fun observe(): Flow<List<ChatMessageEntity>>
    suspend fun ensureGreeting(greeting: String)
    suspend fun send(text: String, name: String, relationship: String, traits: List<String>)
    suspend fun sendVoice(path: String, durationMs: Long)
    suspend fun delete(id: String)
    suspend fun clear()
}
