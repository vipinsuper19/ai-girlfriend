package com.dhama.mybase.core.data

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.dhama.mybase.core.domain.CompanionRepository
import com.dhama.mybase.core.model.SavedCompanion
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class CompanionRepositoryImpl(
    private val dataStore: DataStore<Preferences>,
    private val json: Json = Json { ignoreUnknownKeys = true },
) : CompanionRepository {

    override fun observe(): Flow<SavedCompanion?> {
        return dataStore.data.map { prefs ->
            prefs[KEY]?.let { raw ->
                runCatching { json.decodeFromString<SavedCompanion>(raw) }.getOrNull()
            }
        }
    }

    override suspend fun save(companion: SavedCompanion) {
        dataStore.edit { prefs ->
            prefs[KEY] = json.encodeToString(companion)
        }
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
