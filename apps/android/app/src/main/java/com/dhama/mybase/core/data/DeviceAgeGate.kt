package com.dhama.mybase.core.data

import com.dhama.mybase.core.age.ApiAgeGate
import com.dhama.mybase.core.age.ageSubject
import com.dhama.mybase.core.age.localAgeGatePassed
import com.dhama.mybase.core.age.parseDateOfBirth
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import java.time.LocalDate
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DeviceAgeGate @Inject constructor(
    private val local: AgeLocalStore,
    private val prompt: AgeGatePrompt,
) : ApiAgeGate {
    override suspend fun localGatePassed(): Boolean {
        val stored = local.read()
        val user = Firebase.auth.currentUser
        return localAgeGatePassed(
            confirmed = stored.confirmed,
            dateOfBirth = parseDateOfBirth(stored.dateOfBirth),
            storedSubject = stored.subject,
            currentSubject = ageSubject(user?.uid, user?.email),
            today = LocalDate.now(),
        )
    }

    override fun showAgeGate() {
        prompt.show()
    }
}
