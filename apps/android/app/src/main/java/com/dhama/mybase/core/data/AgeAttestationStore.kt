package com.dhama.mybase.core.data

import com.dhama.mybase.core.age.SEND_AGE_TO_API
import com.dhama.mybase.core.age.ageSubject
import com.dhama.mybase.core.domain.AuthRepository
import javax.inject.Inject
import kotlin.coroutines.cancellation.CancellationException

class AgeAttestationStore @Inject constructor(
    private val local: AgeLocalStore,
    private val authRepository: AuthRepository,
) {
    suspend fun save(dateOfBirth: String, ageConfirmedAt: String): Boolean {
        val user = authRepository.getCurrentUser()
        return local.save(ageSubject(user?.uid, user?.email), dateOfBirth, ageConfirmedAt)
    }

    suspend fun read(): StoredAge = local.read()

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
