package com.aicompanion.feature.splash

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aicompanion.core.data.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

enum class SplashDestination { Welcome, Onboarding, Home }

data class SplashUiState(
    val showSpinner: Boolean = false,
    val destination: SplashDestination? = null,
)

@HiltViewModel
class SplashViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(SplashUiState())
    val state: StateFlow<SplashUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            val spinner = launch {
                delay(600)
                if (_state.value.destination == null) {
                    _state.value = _state.value.copy(showSpinner = true)
                }
            }
            val dest = withTimeoutOrNull(8_000) { resolve() } ?: SplashDestination.Welcome
            spinner.cancel()
            _state.value = SplashUiState(showSpinner = false, destination = dest)
        }
    }

    private suspend fun resolve(): SplashDestination = withContext(Dispatchers.IO) {
        if (!authRepository.hasSession()) return@withContext SplashDestination.Welcome
        if (authRepository.hasActiveCompanion()) {
            SplashDestination.Home
        } else {
            SplashDestination.Onboarding
        }
    }
}
