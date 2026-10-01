package com.aicompanion.feature.auth

sealed interface AuthNavEvent {
    data object Onboarding : AuthNavEvent
    data object Home : AuthNavEvent
    data object Welcome : AuthNavEvent
    data class EmailLogin(val email: String = "") : AuthNavEvent
    data object GoogleLogin : AuthNavEvent
    data object Signup : AuthNavEvent
}

data class AuthFormState(
    val name: String = "",
    val email: String = "",
    val password: String = "",
    val acceptedTerms: Boolean = false,
    val nameError: String? = null,
    val emailError: String? = null,
    val passwordError: String? = null,
    val termsError: String? = null,
    val banner: String? = null,
    val bannerAction: String? = null,
    val warning: Boolean = false,
    val submitting: Boolean = false,
    val googleAvailable: Boolean = true,
)
