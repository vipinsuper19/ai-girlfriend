package com.dhama.mybase.core.domain

import android.app.Activity
import androidx.credentials.GetCredentialResponse
import com.dhama.mybase.core.model.AuthState
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.PhoneAuthProvider
import kotlinx.coroutines.flow.Flow

interface AuthRepository {
    fun isLoggedIn(): Boolean

    fun getCurrentUser(): FirebaseUser?

    suspend fun register(email: String, password: String): Boolean
    suspend fun login(email: String, password: String) : Boolean



    suspend fun signInWithGoogle(result: GetCredentialResponse): Boolean

    suspend fun sendOtp(phoneNumber: String, activity: Activity,
                        callbacks: PhoneAuthProvider.OnVerificationStateChangedCallbacks)
    suspend fun signInWithOtp(verificationId: String, otp: String): Flow<AuthState>

    suspend fun logout()

    suspend fun deleteRemoteAccount()
}