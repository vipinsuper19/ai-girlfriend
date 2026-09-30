package com.dhama.mybase.core.navigation

import kotlinx.serialization.Serializable


@Serializable
data object Splash

// Gate and flows
@Serializable
data object Gate

// Onboarding
@Serializable
data object Welcome
@Serializable
data object SignUp
@Serializable
data object Login

// Top-level tabs
@Serializable
data object Home

@Serializable
data object Onboarding

@Serializable
data object Main
