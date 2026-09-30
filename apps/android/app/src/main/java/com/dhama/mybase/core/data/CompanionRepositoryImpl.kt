package com.dhama.mybase.core.data

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.dhama.mybase.core.domain.CompanionRepository
import com.dhama.mybase.core.model.CompanionDraft
import com.dhama.mybase.core.model.SavedCompanion
import com.dhama.mybase.core.network.ApiClient
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class CompanionRepositoryImpl(
    private val dataStore: DataStore<Preferences>,
    private val api: ApiClient,
    private val json: Json = Json { ignoreUnknownKeys = true },
) : CompanionRepository {

    override fun observe(): Flow<SavedCompanion?> {
        return dataStore.data.map { prefs ->
            prefs[KEY]?.let { raw ->
                runCatching { json.decodeFromString<SavedCompanion>(raw) }.getOrNull()
            }
        }
    }

    override suspend fun create(draft: CompanionDraft): SavedCompanion {
        val saved = draft.toSaved(System.currentTimeMillis())
        if (!api.hasSession()) {
            save(saved)
            return saved
        }
        val serverId = api.createAvatar(draft.toCreateRequest())
        val conversationId = api.createConversation(serverId, saved.name)
        val linked = saved.copy(serverId = serverId, conversationId = conversationId)
        save(linked)
        return linked
    }

    override suspend fun save(companion: SavedCompanion) {
        dataStore.edit { prefs ->
            prefs[KEY] = json.encodeToString(companion)
        }
    }

    override suspend fun saveEdit(current: SavedCompanion, draft: CompanionDraft) {
        val next = draft.toSaved(current.createdAtEpochMs).copy(
            serverId = current.serverId,
            conversationId = current.conversationId,
        )
        val serverId = current.serverId
        if (serverId != null && api.hasSession()) {
            api.patchAvatar(serverId, draft.toCreateRequest())
        }
        save(next)
    }

    override suspend fun archive() {
        val current = observe().first()
        val serverId = current?.serverId
        if (serverId != null && api.hasSession()) {
            api.deleteAvatar(serverId)
        }
        clear()
    }

    override suspend fun clear() {
        dataStore.edit { prefs ->
            prefs.remove(KEY)
        }
    }

    private companion object {
        val KEY = stringPreferencesKey("saved_companion")
    }
}
