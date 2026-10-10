package com.dhama.mybase.core.data

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject


class DataStoreRepo @Inject constructor(
    private val dataStore: DataStore<Preferences>
) {

    fun getInt(key: Preferences.Key<Int>, defaultValue: Boolean): Flow<Int> {
        return dataStore.data
            .map { preferences ->
                preferences[key] ?: 0
            }
    }


    suspend fun saveInt(key: Preferences.Key<Int>, value: Int) {
        dataStore.edit { preferences ->
            preferences[key] = value
        }
    }


    fun getString(key: Preferences.Key<String>, defaultValue: Boolean): Flow<String> {
        return dataStore.data
            .map { preferences ->
                preferences[key] ?: ""
            }
    }


    suspend fun saveString(key: Preferences.Key<String>, value: String) {
        dataStore.edit { preferences ->
            preferences[key] = value
        }
    }


    fun getBoolean(key: Preferences.Key<Boolean>, defaultValue: Boolean): Flow<Boolean> {
        return dataStore.data
            .map { preferences ->
                preferences[key] ?: defaultValue
            }
    }


    suspend fun saveBoolean(key: Preferences.Key<Boolean>, value: Boolean) {
        dataStore.edit { preferences ->
            preferences[key] = value
        }
    }

}