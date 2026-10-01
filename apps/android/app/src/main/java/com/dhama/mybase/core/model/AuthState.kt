package com.dhama.mybase.core.model

import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.PhoneAuthProvider

sealed class AuthState {
    object Initial : AuthState()
    object Loading : AuthState()
    data class OtpSent(val verificationId: String, val token: PhoneAuthProvider.ForceResendingToken) : AuthState()
    data class Success(val firebaseUser: FirebaseUser?) : AuthState()
    data class Error(val message: String) : AuthState()
}