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
        clientMessageId: String? = null,
    )
    suspend fun sendVoice(path: String, durationMs: Long, conversationId: Int? = null)
    suspend fun speak(companionId: Int, text: String): String
    suspend fun delete(id: String)
    suspend fun regenerate(id: String)
    suspend fun discard(id: String)
    suspend fun reload(conversationId: Int)
    suspend fun loadOlder(conversationId: Int, beforeId: Int): Int
    /** Reload, then ask for the missing reply when the thread still ends on the user. */
    suspend fun retryUnfinishedReply(conversationId: Int)
    /**
     * "Not sent · Retry". Reloads first and reuses [clientMessageId] so a line the
     * server already kept is not posted again.
     */
    suspend fun retryUnsent(
        text: String,
        name: String,
        relationship: String,
        traits: List<String>,
        conversationId: Int?,
        clientMessageId: String,
        failedLocalId: String,
    )
    suspend fun note(text: String)
    suspend fun clear()
}
