package com.aicompanion.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aicompanion.core.common.AppError
import com.aicompanion.core.common.AppResult
import com.aicompanion.core.common.isValidEmail
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

@HiltViewModel
class SignupViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(AuthFormState())
    val state: StateFlow<AuthFormState> = _state.asStateFlow()

    private val events = Channel<AuthNavEvent>(Channel.BUFFERED)
    val navEvents = events.receiveAsFlow()

    fun onNameChange(value: String) {
        _state.update {
            it.copy(name = value, nameError = if (it.nameError != null) nameError(value) else null)
        }
    }

    fun onEmailChange(value: String) {
        _state.update {
            it.copy(email = value, emailError = if (it.emailError != null) emailError(value) else null, banner = null)
        }
    }

    fun onPasswordChange(value: String) {
        _state.update {
            it.copy(
                password = value,
                passwordError = if (it.passwordError != null) passwordError(value) else null,
            )
        }
    }

    fun onTermsChange(checked: Boolean) {
        _state.update { it.copy(acceptedTerms = checked, termsError = null) }
    }

    fun submit() {
        val current = _state.value
        val nameErr = nameError(current.name)
        val emailErr = emailError(current.email)
        val passwordErr = passwordError(current.password)
        val termsErr = if (!current.acceptedTerms) "Please accept the Terms to continue" else null
        if (nameErr != null || emailErr != null || passwordErr != null || termsErr != null) {
            _state.update {
                it.copy(
                    nameError = nameErr,
                    emailError = emailErr,
                    passwordError = passwordErr,
                    termsError = termsErr,
                )
            }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(submitting = true, banner = null) }
            when (val result = authRepository.register(current.name, current.email, current.password)) {
                is AppResult.Ok -> {
                    events.send(AuthNavEvent.Onboarding)
                    _state.update { it.copy(submitting = false) }
                }
                is AppResult.Err -> handle(result.error)
            }
        }
    }

    fun loginInstead() {
        viewModelScope.launch {
            events.send(AuthNavEvent.EmailLogin(_state.value.email.trim().lowercase()))
        }
    }

    private fun handle(error: AppError) {
        if (error is AppError.Conflict) {
            _state.update {
                it.copy(
                    submitting = false,
                    emailError = error.message,
                    banner = null,
                )
            }
        } else {
            _state.update {
                it.copy(submitting = false, banner = error.bannerText(), warning = error is AppError.Offline)
            }
        }
    }

    private fun nameError(value: String): String? =
        if (value.trim().length < 2) "Your name needs at least 2 characters" else null

    private fun emailError(value: String): String? = when {
        value.isBlank() || !isValidEmail(value) -> "Enter a valid email address"
        else -> null
    }

    private fun passwordError(value: String): String? =
        if (value.length < 8) "Use at least 8 characters" else null
}
