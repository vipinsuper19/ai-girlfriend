package com.aicompanion.feature.auth

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aicompanion.core.common.AppError
import com.aicompanion.core.common.AppResult
import com.aicompanion.core.data.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class GoogleLoginState(
    val submitting: Boolean = false,
    val banner: String? = null,
    val warning: Boolean = false,
    val available: Boolean = true,
)

@HiltViewModel
class GoogleLoginViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val googleAuthClient: GoogleAuthClient,
) : ViewModel() {
    private val _state = MutableStateFlow(GoogleLoginState(available = googleAuthClient.isAvailable()))
    val state: StateFlow<GoogleLoginState> = _state.asStateFlow()

    private val events = Channel<AuthNavEvent>(Channel.BUFFERED)
    val navEvents = events.receiveAsFlow()

    fun continueWithGoogle(activityContext: Context) {
        if (_state.value.submitting) return
        viewModelScope.launch {
            _state.update { it.copy(submitting = true, banner = null) }
            when (val token = googleAuthClient.getIdToken(activityContext)) {
                is AppResult.Err -> {
                    if (token.error is AppError.Cancelled) {
                        _state.update { it.copy(submitting = false, banner = null) }
                    } else {
                        _state.update {
                            it.copy(submitting = false, banner = token.error.bannerText().ifBlank {
                                "Google sign-in didn't go through. Try again, or sign in with email."
                            })
                        }
                    }
                }
                is AppResult.Ok -> when (val result = authRepository.loginWithGoogle(token.value)) {
                    is AppResult.Ok -> {
                        val dest = if (authRepository.hasActiveCompanion()) {
                            AuthNavEvent.Home
                        } else {
                            AuthNavEvent.Onboarding
                        }
                        events.send(dest)
                        _state.update { it.copy(submitting = false) }
                    }
                    is AppResult.Err -> handleGoogleApi(result.error, token.value)
                }
            }
        }
    }

    fun onSignInWithEmail() {
        viewModelScope.launch { events.send(AuthNavEvent.EmailLogin()) }
    }

    fun onCreateAccount() {
        viewModelScope.launch { events.send(AuthNavEvent.Signup) }
    }

    private fun handleGoogleApi(error: AppError, idToken: String) {
        val unlinked = error is AppError.Conflict
        _state.update {
            it.copy(
                submitting = false,
                warning = unlinked,
                banner = if (unlinked) {
                    "An account with this email already exists. Sign in with your password."
                } else {
                    "Google sign-in didn't go through. Try again, or sign in with email."
                },
            )
        }
        if (unlinked) {
            viewModelScope.launch {
                events.send(AuthNavEvent.EmailLogin(emailFromIdToken(idToken)))
            }
        }
    }

    private fun emailFromIdToken(idToken: String): String {
        return runCatching {
            val payload = idToken.split(".").getOrNull(1) ?: return ""
            val padded = payload + "=".repeat((4 - payload.length % 4) % 4)
            val json = String(android.util.Base64.decode(padded, android.util.Base64.URL_SAFE))
            Regex("\"email\"\\s*:\\s*\"([^\"]+)\"").find(json)?.groupValues?.getOrNull(1).orEmpty()
        }.getOrDefault("")
    }
}
