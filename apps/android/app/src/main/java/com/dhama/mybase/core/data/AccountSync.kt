package com.dhama.mybase.core.data

import com.dhama.mybase.core.chat.MESSAGE_PAGE
import com.dhama.mybase.core.db.dao.ChatMessageDao
import com.dhama.mybase.core.db.dao.MemoryDao
import com.dhama.mybase.core.db.entity.ChatMessageEntity
import com.dhama.mybase.core.db.entity.MemoryEntity
import com.dhama.mybase.core.domain.CompanionRepository
import com.dhama.mybase.core.model.SavedCompanion
import com.dhama.mybase.core.network.ApiClient
import com.dhama.mybase.core.network.ApiStatusException
import com.dhama.mybase.core.network.RemoteAvatarSummary
import com.dhama.mybase.core.network.RemoteConversation
import com.dhama.mybase.core.network.RestoredMemory
import com.dhama.mybase.core.network.RestoredMessage
import com.dhama.mybase.core.network.serverRecordId
import com.dhama.mybase.core.network.apiJson
import com.dhama.mybase.core.network.planLabel
import com.dhama.mybase.core.network.toRestored
import kotlinx.serialization.encodeToString
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
            dataStore.saveString(PreferencesKeys.USAGE_SUMMARY, "")
            return local
        }
        syncProfile()
        syncPlan()
        syncUsage()
        return try {
            pull(local, null)
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            companions.observe().first() ?: local
        }
    }

    suspend fun refreshPlan() {
        if (!api.hasSession()) {
            dataStore.saveString(PreferencesKeys.SUBSCRIPTION_PLAN, "")
            dataStore.saveString(PreferencesKeys.USAGE_SUMMARY, "")
            return
        }
        syncPlan()
        syncUsage()
    }

    suspend fun archivedCompanions(): List<RemoteAvatarSummary> {
        if (!api.hasSession()) return emptyList()
        return api.listArchivedAvatars()
    }

    suspend fun unarchive(id: Int): SavedCompanion {
        if (!api.hasSession()) {
            throw ApiStatusException(401, "Sign in with email to bring her back.", null)
        }
        api.restoreAvatar(id)
        return pull(companions.observe().first(), id)
            ?: throw ApiStatusException(0, "Couldn't bring her back.", null)
    }

    suspend fun refreshUsage() {
        if (!api.hasSession()) {
            dataStore.saveString(PreferencesKeys.USAGE_SUMMARY, "")
            return
        }
        syncUsage()
    }

    suspend fun saveDisplayName(name: String): String {
        if (!api.hasSession()) return name
        val updated = api.patchDisplayName(name)
        return updated.displayName?.trim().orEmpty().ifBlank { name }
    }

    private suspend fun syncUsage() {
        try {
            val summary = api.usageSummary()
            dataStore.saveString(PreferencesKeys.USAGE_SUMMARY, apiJson().encodeToString(summary))
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            // The last saved allowance stays on screen.
        }
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

    suspend fun listCompanionConversations(): List<RemoteConversation> {
        val current = companions.observe().first() ?: return emptyList()
        val serverId = current.serverId ?: return emptyList()
        if (!api.hasSession()) return emptyList()
        return api.listConversations().filter { it.companionId == serverId }
    }

    suspend fun openConversation(conversationId: Int) {
        val current = companions.observe().first() ?: return
        if (current.serverId == null || !api.hasSession()) return
        replaceThread(current.copy(conversationId = conversationId), conversationId)
    }

    suspend fun startConversation(): Int {
        val current = companions.observe().first()
            ?: throw ApiStatusException(0, "Create her before starting a conversation.", null)
        val serverId = current.serverId
        if (serverId == null || !api.hasSession()) {
            throw ApiStatusException(401, "Sign in with email to start another conversation.", null)
        }
        val created = api.createConversation(serverId, current.name)
        replaceThread(current.copy(conversationId = created), created)
        return created
    }

    suspend fun deleteConversation(conversationId: Int) {
        val current = companions.observe().first() ?: return
        if (current.serverId == null || !api.hasSession()) {
            throw ApiStatusException(401, "Sign in with email to delete a conversation.", null)
        }
        api.deleteConversation(conversationId)
        if (current.conversationId != conversationId) return
        val remaining = api.listConversations()
            .filter { it.companionId == current.serverId && it.id != conversationId }
        val next = remaining.firstOrNull()?.id ?: api.createConversation(current.serverId, current.name)
        replaceThread(current.copy(conversationId = next), next)
    }

    private suspend fun replaceThread(saved: SavedCompanion, conversationId: Int) {
        val remoteMessages = api.listMessages(conversationId, limit = MESSAGE_PAGE)
        val failedLocal = messages.snapshot().filter { message ->
            message.delivery == DELIVERY_FAILED && serverRecordId(message.id) == null
        }
        companions.save(saved)
        messages.clear()
        remoteMessages.forEach { remote ->
            messages.upsert(remote.toRestored(api.origin()).toEntity())
        }
        if (remoteMessages.isEmpty() && saved.greeting.isNotBlank()) {
            messages.upsert(
                ChatMessageEntity(
                    id = "greeting",
                    role = "ASSISTANT",
                    text = saved.greeting,
                    createdAtEpochMs = System.currentTimeMillis(),
                    delivery = "SENT",
                ),
            )
        }
        failedLocal.forEach { messages.upsert(it) }
    }

    private suspend fun pull(local: SavedCompanion?, preferredId: Int?): SavedCompanion? {
        val summaries = api.listAvatars()
        if (summaries.isEmpty()) return local
        val id = preferredId?.takeIf { preferred -> summaries.any { it.id == preferred } }
            ?: local?.serverId?.takeIf { serverId -> summaries.any { it.id == serverId } }
            ?: summaries.first().id
        val avatar = api.getAvatar(id)
        val name = avatar.name.ifBlank { "Companion" }
        val forCompanion = api.listConversations().filter { it.companionId == id }
        val conversationId = forCompanion.firstOrNull { it.id == local?.conversationId }?.id
            ?: forCompanion.firstOrNull()?.id
            ?: api.createConversation(id, name)
        val saved = avatar.toSaved(conversationId, System.currentTimeMillis(), api.origin())
        val remoteMessages = api.listMessages(conversationId, limit = MESSAGE_PAGE)
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
