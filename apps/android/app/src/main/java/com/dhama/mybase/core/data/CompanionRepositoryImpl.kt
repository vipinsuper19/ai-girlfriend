package com.dhama.mybase.core.data

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.dhama.mybase.core.domain.CompanionRepository
import com.dhama.mybase.core.model.CompanionDraft
import com.dhama.mybase.core.model.SavedCompanion
import com.dhama.mybase.core.network.ApiClient
import com.dhama.mybase.core.network.ApiStatusException
import com.dhama.mybase.core.voice.resolveVoiceUrl
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
            avatarUrl = current.avatarUrl,
        )
        val serverId = current.serverId
        if (serverId != null && api.hasSession()) {
            val request = draft.toCreateRequest().let { body ->
                if (current.avatarUrl.isBlank()) body
                else body.copy(appearance = body.appearance.copy(avatarUrl = current.avatarUrl))
            }
            api.patchAvatar(serverId, request)
        }
        save(next)
    }

    override suspend fun uploadPhoto(bytes: ByteArray, mime: String) {
        val current = observe().first()
            ?: throw ApiStatusException(0, "Create her before adding a photo.", null)
        val serverId = current.serverId
        if (serverId == null || !api.hasSession()) {
            throw ApiStatusException(401, "Sign in with email to keep her photo.", null)
        }
        val raw = api.uploadAvatar(serverId, bytes, mime)
        val resolved = raw.takeIf { it.isNotBlank() }?.let { resolveVoiceUrl(api.origin(), it) }.orEmpty()
        if (resolved.isBlank()) throw ApiStatusException(0, "Couldn't save her photo.", null)
        save(current.copy(avatarUrl = resolved))
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
