package com.dhama.mybase.ui.home

import androidx.lifecycle.ViewModel
import com.dhama.mybase.core.data.DataStoreRepo
import com.dhama.mybase.core.domain.AuthRepository
import com.dhama.mybase.core.domain.CompanionRepository
import com.dhama.mybase.core.utils.PreferencesKeys
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.first
import javax.inject.Inject

enum class PostAuthDestination {
    Welcome,
    Onboarding,
    Home,
}

@HiltViewModel
class PostAuthViewModel @Inject constructor(
    private val dataStoreRepo: DataStoreRepo,
    private val companionRepository: CompanionRepository,
    private val authRepository: AuthRepository,
) : ViewModel() {

    suspend fun destination(): PostAuthDestination {
        val flagged = dataStoreRepo.getBoolean(PreferencesKeys.IS_LOGGED_IN, false).first()
        val loggedIn = flagged || authRepository.isLoggedIn()
        if (!loggedIn) return PostAuthDestination.Welcome
        if (!flagged) {
            dataStoreRepo.saveBoolean(PreferencesKeys.IS_LOGGED_IN, true)
        }
        val companion = companionRepository.observe().first()
        return if (companion == null) PostAuthDestination.Onboarding else PostAuthDestination.Home
    }
}
