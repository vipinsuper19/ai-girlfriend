package com.aicompanion.navigation

import kotlinx.serialization.Serializable

@Serializable
data object SplashRoute

@Serializable
data object AuthGraphRoute

@Serializable
data object WelcomeRoute

@Serializable
data object LoginRoute

@Serializable
data class LoginEmailRoute(val email: String = "")

@Serializable
data object SignupRoute

@Serializable
data object OnboardingRoute

@Serializable
data object HomeRoute
