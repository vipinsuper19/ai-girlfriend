package com.dhama.mybase.ui.home

import androidx.lifecycle.ViewModel
import com.dhama.mybase.core.age.AgeRoute
import com.dhama.mybase.core.age.ageRoute
import com.dhama.mybase.core.age.ageSubject
import com.dhama.mybase.core.age.parseDateOfBirth
import com.dhama.mybase.core.data.AccountSync
import com.dhama.mybase.core.data.AgeAttestationStore
import com.dhama.mybase.core.data.DataStoreRepo
import com.dhama.mybase.core.domain.AuthRepository
import com.dhama.mybase.core.utils.PreferencesKeys
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.first
import java.time.LocalDate
import javax.inject.Inject

enum class PostAuthDestination {
    Welcome,
    AgeConfirm,
    Onboarding,
    Home,
}

@HiltViewModel
class PostAuthViewModel @Inject constructor(
    private val dataStoreRepo: DataStoreRepo,
    private val accountSync: AccountSync,
    private val authRepository: AuthRepository,
    private val ageAttestation: AgeAttestationStore,
) : ViewModel() {

    suspend fun destination(): PostAuthDestination {
        val flagged = dataStoreRepo.getBoolean(PreferencesKeys.IS_LOGGED_IN, false).first()
        val loggedIn = flagged || authRepository.isLoggedIn()
        if (!loggedIn) return PostAuthDestination.Welcome
        if (!flagged) {
            dataStoreRepo.saveBoolean(PreferencesKeys.IS_LOGGED_IN, true)
        }
        val user = authRepository.getCurrentUser()
        val stored = ageAttestation.read()
        val confirmed = stored.confirmed
        val dateOfBirth = parseDateOfBirth(stored.dateOfBirth)
        val storedSubject = stored.subject
        val currentSubject = ageSubject(user?.uid, user?.email)
        val today = LocalDate.now()
        // A saved companion must not skip the age screen. Restore only after the gate passes.
        val blocked = ageRoute(
            loggedIn = true,
            ageConfirmed = confirmed,
            dateOfBirth = dateOfBirth,
            storedSubject = storedSubject,
            currentSubject = currentSubject,
            hasCompanion = false,
            today = today,
        )
        if (blocked == AgeRoute.ConfirmAge) return PostAuthDestination.AgeConfirm
        val companion = accountSync.restore()
        return ageRoute(
            loggedIn = true,
            ageConfirmed = confirmed,
            dateOfBirth = dateOfBirth,
            storedSubject = storedSubject,
            currentSubject = currentSubject,
            hasCompanion = companion != null,
            today = today,
        ).toDestination()
    }
}

private fun AgeRoute.toDestination(): PostAuthDestination = when (this) {
    AgeRoute.Welcome -> PostAuthDestination.Welcome
    AgeRoute.ConfirmAge -> PostAuthDestination.AgeConfirm
    AgeRoute.Onboarding -> PostAuthDestination.Onboarding
    AgeRoute.Home -> PostAuthDestination.Home
}
