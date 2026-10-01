package com.dhama.mybase.core.data

import android.content.SharedPreferences
import javax.inject.Inject
import androidx.core.content.edit

class PreferencesRepo @Inject constructor(
    private val sharedPreferences: SharedPreferences
) {
    fun saveString(key: String, value: String) {
        sharedPreferences.edit(true) { putString(key, value) }
    }

    fun getString(key: String, defaultValue: String): String {
        return sharedPreferences.getString(key, defaultValue) ?: defaultValue
    }

    fun saveBoolean(key: String, value: Boolean) {
        sharedPreferences.edit(true) { putBoolean(key, value) }
    }

    fun getBoolean(key: String, defaultValue: Boolean): Boolean {
        return sharedPreferences.getBoolean(key, defaultValue)
    }

    fun saveInt(key: String, value: Int) {
        sharedPreferences.edit(true) { putInt(key, value) }
    }

    fun getInt(key: String, defaultValue: Int): Int {
        return sharedPreferences.getInt(key, defaultValue)
    }


    // ... other save/get methods
}