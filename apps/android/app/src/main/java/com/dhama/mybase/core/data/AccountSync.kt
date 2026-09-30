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
import com.dhama.mybase.core.network.planLabel
import com.dhama.mybase.core.network.toRestored
import com.dhama.mybase.core.network.toSaved
import com.dhama.mybase.core.utils.PreferencesKeys
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import kotlin.coroutines.cancellation.CancellationException

class AccountSync @Inject constructor(
    private val api: ApiClient,
    private val companions: CompanionRepository,
    private val messages: ChatMessageDao,
    private val memories: MemoryDao,
    private val dataStore: DataStoreRepo,
) {
    suspend fun restore(): SavedCompanion? {
        val local = companions.observe().first()
        if (!api.hasSession()) {
            dataStore.saveString(PreferencesKeys.SUBSCRIPTION_PLAN, "")
            return local
        }
        syncProfile()
        syncPlan()
        return try {
            pull(local)
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            companions.observe().first() ?: local
        }
    }

    suspend fun refreshPlan() {
        if (!api.hasSession()) {
            dataStore.saveString(PreferencesKeys.SUBSCRIPTION_PLAN, "")
            return
        }
        syncPlan()
    }

    suspend fun saveDisplayName(name: String): String {
        if (!api.hasSession()) return name
        val updated = api.patchDisplayName(name)
        return updated.displayName?.trim().orEmpty().ifBlank { name }
    }

    private suspend fun syncPlan() {
        try {
            val label = planLabel(api.currentSubscription().plan)
            if (label.isNotBlank()) {
                dataStore.saveString(PreferencesKeys.SUBSCRIPTION_PLAN, label)
            }
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            // Home still opens when the plan row cannot be read.
        }
    }

    private suspend fun syncProfile() {
        try {
            val me = api.getMe()
            val displayName = me.displayName?.trim().orEmpty()
            val email = me.email?.trim().orEmpty()
            if (displayName.isNotBlank()) {
                dataStore.saveString(PreferencesKeys.DISPLAY_NAME, displayName)
            }
            if (email.isNotBlank()) {
                dataStore.saveString(PreferencesKeys.USER_EMAIL, email)
            }
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            // Her profile can still load when the account row cannot.
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
        val saved = avatar.toSaved(conversationId, System.currentTimeMillis(), api.origin())
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
