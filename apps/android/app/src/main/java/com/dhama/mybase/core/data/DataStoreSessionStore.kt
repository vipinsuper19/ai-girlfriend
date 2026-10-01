package com.dhama.mybase.core.data

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.dhama.mybase.core.network.SessionStore
import com.dhama.mybase.core.network.SessionTokens
import kotlinx.coroutines.flow.first

class DataStoreSessionStore(
    private val dataStore: DataStore<Preferences>,
) : SessionStore {

    override suspend fun read(): SessionTokens? {
        val prefs = dataStore.data.first()
        val access = prefs[ACCESS]?.takeIf { it.isNotBlank() } ?: return null
        val refresh = prefs[REFRESH]?.takeIf { it.isNotBlank() } ?: return null
        return SessionTokens(access, refresh)
    }

    override suspend fun write(tokens: SessionTokens) {
        dataStore.edit { prefs ->
            prefs[ACCESS] = tokens.accessToken
            prefs[REFRESH] = tokens.refreshToken
        }
    }

    override suspend fun clear() {
        dataStore.edit { prefs ->
            prefs.remove(ACCESS)
            prefs.remove(REFRESH)
        }
    }

    private companion object {
        val ACCESS = stringPreferencesKey("api_access_token")
        val REFRESH = stringPreferencesKey("api_refresh_token")
    }
}
