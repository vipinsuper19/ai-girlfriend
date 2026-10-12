package com.dhama.mybase.core.data

import com.dhama.mybase.core.age.SEND_AGE_TO_API
import com.dhama.mybase.core.age.ageSubject
import com.dhama.mybase.core.domain.AuthRepository
import com.dhama.mybase.core.utils.PreferencesKeys
import javax.inject.Inject
import kotlin.coroutines.cancellation.CancellationException

class AgeAttestationStore @Inject constructor(
    private val dataStore: DataStoreRepo,
    private val authRepository: AuthRepository,
) {
    suspend fun save(dateOfBirth: String, ageConfirmedAt: String) {
        val subject = ageSubject(
            authRepository.getCurrentUser()?.uid,
            authRepository.getCurrentUser()?.email,
        )
        dataStore.saveString(PreferencesKeys.DATE_OF_BIRTH, dateOfBirth)
        dataStore.saveBoolean(PreferencesKeys.AGE_CONFIRMED, true)
        dataStore.saveString(PreferencesKeys.AGE_CONFIRMED_AT, ageConfirmedAt)
        if (subject.isNotBlank()) {
            dataStore.saveString(PreferencesKeys.AGE_SUBJECT, subject)
        }
    }

    /** PATCH /users/me/age once the backend accepts it. No-op while the switch is off. */
    suspend fun pushIfEnabled(dateOfBirth: String, ageConfirmedAt: String) {
        if (!SEND_AGE_TO_API) return
        try {
            authRepository.submitAge(dateOfBirth, ageConfirmedAt)
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            // The confirmation already lives on this device.
        }
    }
}
