package com.dhama.mybase.core.data

import com.dhama.mybase.core.age.AgeSeal
import com.dhama.mybase.core.age.acceptsSealedAge
import com.dhama.mybase.core.utils.PreferencesKeys
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.cancellation.CancellationException

data class StoredAge(
    val dateOfBirth: String = "",
    val confirmed: Boolean = false,
    val confirmedAt: String = "",
    val subject: String = "",
)

/**
 * The date of birth is stored only as Keystore ciphertext.
 * Confirmation, timestamp, and subject stay beside it and are removed with it.
 */
@Singleton
class AgeLocalStore @Inject constructor(
    private val dataStore: DataStoreRepo,
    private val seal: AgeSeal,
) {
    suspend fun save(subject: String, dateOfBirth: String, ageConfirmedAt: String): Boolean {
        val sealed = try {
            seal.seal(dateOfBirth)
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            return false
        }
        if (!acceptsSealedAge(dateOfBirth, sealed)) return false
        dataStore.update { prefs ->
            prefs.remove(PreferencesKeys.DATE_OF_BIRTH)
            prefs[PreferencesKeys.DATE_OF_BIRTH_SEALED] = sealed
            prefs[PreferencesKeys.AGE_CONFIRMED] = true
            prefs[PreferencesKeys.AGE_CONFIRMED_AT] = ageConfirmedAt
            if (subject.isNotBlank()) prefs[PreferencesKeys.AGE_SUBJECT] = subject
        }
        return true
    }

    suspend fun read(): StoredAge {
        migratePlaintext()
        val sealed = dataStore.getString(PreferencesKeys.DATE_OF_BIRTH_SEALED, false).first()
        val dateOfBirth = if (sealed.isBlank()) "" else seal.open(sealed).orEmpty()
        return StoredAge(
            dateOfBirth = dateOfBirth,
            confirmed = dataStore.getBoolean(PreferencesKeys.AGE_CONFIRMED, false).first(),
            confirmedAt = dataStore.getString(PreferencesKeys.AGE_CONFIRMED_AT, false).first(),
            subject = dataStore.getString(PreferencesKeys.AGE_SUBJECT, false).first(),
        )
    }

    suspend fun clear() {
        try {
            seal.discard()
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            // Preferences are still wiped below.
        }
        dataStore.update { prefs ->
            prefs.remove(PreferencesKeys.DATE_OF_BIRTH)
            prefs.remove(PreferencesKeys.DATE_OF_BIRTH_SEALED)
            prefs.remove(PreferencesKeys.AGE_CONFIRMED)
            prefs.remove(PreferencesKeys.AGE_CONFIRMED_AT)
            prefs.remove(PreferencesKeys.AGE_SUBJECT)
        }
    }

    private suspend fun migratePlaintext() {
        val legacy = dataStore.getString(PreferencesKeys.DATE_OF_BIRTH, false).first()
        if (legacy.isBlank()) return
        val sealed = try {
            seal.seal(legacy)
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            null
        }
        dataStore.update { prefs ->
            prefs.remove(PreferencesKeys.DATE_OF_BIRTH)
            if (sealed != null && acceptsSealedAge(legacy, sealed)) {
                prefs[PreferencesKeys.DATE_OF_BIRTH_SEALED] = sealed
            }
        }
    }
}
