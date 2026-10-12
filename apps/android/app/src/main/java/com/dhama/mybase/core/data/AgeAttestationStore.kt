package com.dhama.mybase.core.data

import com.dhama.mybase.core.age.ageSubject
import com.dhama.mybase.core.domain.AuthRepository
import javax.inject.Inject

class AgeAttestationStore @Inject constructor(
    private val local: AgeLocalStore,
    private val authRepository: AuthRepository,
    private val server: AgeServerSync,
) {
    suspend fun save(dateOfBirth: String, ageConfirmedAt: String): Boolean {
        val user = authRepository.getCurrentUser()
        return local.save(ageSubject(user?.uid, user?.email), dateOfBirth, ageConfirmedAt)
    }

    suspend fun read(): StoredAge = local.read()

    /** PATCH /users/me/age in the background. The date of birth stays on this device. */
    fun syncAfterSave() {
        server.afterLocalPass()
    }
}
