package com.aicompanion.feature.auth

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class WelcomeViewModel @Inject constructor(
    googleAuthClient: GoogleAuthClient,
) : ViewModel() {
    val googleAvailable: Boolean = googleAuthClient.isAvailable()
}
