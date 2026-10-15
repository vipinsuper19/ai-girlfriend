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

    suspend fun login(email: String, password: String): Boolean

    suspend fun changePassword(currentPassword: String, newPassword: String)

    suspend fun signInWithGoogle(result: GetCredentialResponse): Boolean

    suspend fun sendOtp(phoneNumber: String, activity: Activity,
                        callbacks: PhoneAuthProvider.OnVerificationStateChangedCallbacks)
    suspend fun signInWithOtp(verificationId: String, otp: String): Flow<AuthState>

    suspend fun logout()

    /**
     * DELETE /users/me. Returns true when the body says the Admin SDK already deleted the Firebase user.
     * Throws when the server delete fails. Does not touch Firebase Auth or local data.
     */
    suspend fun deleteRemoteAccount(): Boolean

    /**
     * Deletes the signed-in Firebase user. Reauthenticates once when Firebase requires a recent login.
     * [emailPassword] and [googleIdToken] are used only for that reauthentication.
     */
    suspend fun deleteFirebaseAuthUser(
        serverDeletedFirebaseUser: Boolean,
        emailPassword: String?,
        googleIdToken: String?,
    )

    /**
     * Signs Firebase out, then clears the API session store.
     * Returns false and leaves the store untouched when Firebase is still signed in.
     */
    suspend fun signInAgainAfterDelete(): Boolean
}