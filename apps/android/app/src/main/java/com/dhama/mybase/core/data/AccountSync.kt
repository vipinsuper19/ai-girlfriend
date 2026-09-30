package com.dhama.mybase.core.data

import com.dhama.mybase.core.db.dao.ChatMessageDao
import com.dhama.mybase.core.db.dao.MemoryDao
import com.dhama.mybase.core.db.entity.ChatMessageEntity
import com.dhama.mybase.core.db.entity.MemoryEntity
import com.dhama.mybase.core.domain.CompanionRepository
import com.dhama.mybase.core.model.SavedCompanion
import com.dhama.mybase.core.network.ApiClient
import com.dhama.mybase.core.network.RestoredMemory
import com.dhama.mybase.core.network.RestoredMessage
import com.dhama.mybase.core.network.serverRecordId
import com.dhama.mybase.core.network.toRestored
import com.dhama.mybase.core.network.toSaved
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import kotlin.coroutines.cancellation.CancellationException

class AccountSync @Inject constructor(
    private val api: ApiClient,
    private val companions: CompanionRepository,
    private val messages: ChatMessageDao,
    private val memories: MemoryDao,
) {
    suspend fun restore(): SavedCompanion? {
        val local = companions.observe().first()
        if (!api.hasSession()) return local
        return try {
            pull(local)
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            companions.observe().first() ?: local
        }
    }

    private suspend fun pull(local: SavedCompanion?): SavedCompanion? {
        val summaries = api.listAvatars()
        if (summaries.isEmpty()) return local
        val id = local?.serverId?.takeIf { serverId -> summaries.any { it.id == serverId } }
            ?: summaries.first().id
        val avatar = api.getAvatar(id)
        val name = avatar.name.ifBlank { "Companion" }
        val conversationId = api.listConversations()
            .firstOrNull { it.companionId == id }
            ?.id
            ?: api.createConversation(id, name)
        val saved = avatar.toSaved(conversationId, System.currentTimeMillis())
        val remoteMessages = api.listMessages(conversationId)
        val remoteMemories = api.listMemories(id)
        val failedLocal = messages.snapshot().filter { message ->
            message.delivery == DELIVERY_FAILED && serverRecordId(message.id) == null
        }
        val serverContents = remoteMemories.map { it.content }.toSet()
        val keptLocal = memories.snapshot().filter { memory ->
            serverRecordId(memory.id) == null && memory.content !in serverContents
        }
        val now = System.currentTimeMillis()
        companions.save(saved)
        messages.clear()
        remoteMessages.forEach { remote ->
            messages.upsert(remote.toRestored(api.origin()).toEntity())
        }
        failedLocal.forEach { messages.upsert(it) }
        memories.clear()
        remoteMemories.forEach { remote ->
            memories.upsert(remote.toRestored(now).toEntity())
        }
        keptLocal.forEach { memories.upsert(it) }
        return saved
    }

    private companion object {
        const val DELIVERY_FAILED = "FAILED"
    }
}

private fun RestoredMessage.toEntity(): ChatMessageEntity {
    return ChatMessageEntity(
        id = id,
        role = role,
        text = text,
        createdAtEpochMs = createdAtEpochMs,
        delivery = "SENT",
        kind = kind,
        audioPath = audioPath,
    )
}

private fun RestoredMemory.toEntity(): MemoryEntity {
    return MemoryEntity(
        id = id,
        type = type,
        content = content,
        importance = importance,
        confidence = confidence,
        source = source,
        createdAtEpochMs = createdAtEpochMs,
        updatedAtEpochMs = updatedAtEpochMs,
    )
}
