package com.aicompanion.feature.auth

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.toRoute
import com.aicompanion.core.common.AppError
import com.aicompanion.core.common.AppResult
import com.aicompanion.core.common.FeatureFlags
import com.aicompanion.core.common.isValidEmail
import com.aicompanion.core.data.AuthRepository
import com.aicompanion.navigation.LoginEmailRoute
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

@HiltViewModel
class EmailLoginViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {
    val passwordResetEnabled = FeatureFlags.PASSWORD_RESET
    private val initialEmail: String = savedStateHandle.toRoute<LoginEmailRoute>().email

    private val _state = MutableStateFlow(AuthFormState(email = initialEmail))
    val state: StateFlow<AuthFormState> = _state.asStateFlow()

    private val events = Channel<AuthNavEvent>(Channel.BUFFERED)
    val navEvents = events.receiveAsFlow()

    fun onEmailChange(value: String) {
        _state.update {
            it.copy(
                email = value,
                emailError = if (it.emailError != null) emailError(value) else null,
                banner = null,
            )
        }
    }

    fun onPasswordChange(value: String) {
        _state.update {
            it.copy(
                password = value,
                passwordError = if (it.passwordError != null) passwordError(value) else null,
                banner = null,
            )
        }
    }

    fun submit() {
        val current = _state.value
        val emailErr = emailError(current.email)
        val passwordErr = passwordError(current.password)
        if (emailErr != null || passwordErr != null) {
            _state.update { it.copy(emailError = emailErr, passwordError = passwordErr) }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(submitting = true, banner = null) }
            when (val result = authRepository.login(current.email, current.password)) {
                is AppResult.Ok -> succeed()
                is AppResult.Err -> handle(result.error)
            }
        }
    }

    fun onGoogleOnlyAction() {
        viewModelScope.launch { events.send(AuthNavEvent.GoogleLogin) }
    }

    private suspend fun succeed() {
        val dest = if (authRepository.hasActiveCompanion()) AuthNavEvent.Home else AuthNavEvent.Onboarding
        events.send(dest)
        _state.update { it.copy(submitting = false) }
    }

    private fun handle(error: AppError) {
        val googleOnly = error is AppError.Unauthorized &&
            error.message.contains("google", ignoreCase = true)
        _state.update {
            it.copy(
                submitting = false,
                password = if (error is AppError.Unauthorized) "" else it.password,
                banner = error.bannerText(),
                warning = error is AppError.Offline || googleOnly,
                bannerAction = if (googleOnly) "Continue with Google" else null,
            )
        }
    }

    private fun emailError(value: String): String? = when {
        value.isBlank() -> "Enter a valid email address"
        !isValidEmail(value) -> "Enter a valid email address"
        else -> null
    }

    private fun passwordError(value: String): String? =
        if (value.isBlank()) "Enter your password" else null
}
