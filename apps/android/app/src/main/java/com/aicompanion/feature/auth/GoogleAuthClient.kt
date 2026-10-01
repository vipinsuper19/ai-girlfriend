package com.aicompanion.feature.auth

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import com.aicompanion.BuildConfig
import com.aicompanion.core.common.AppError
import com.aicompanion.core.common.AppResult
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GoogleAuthClient @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    fun isAvailable(): Boolean {
        if (BuildConfig.GOOGLE_WEB_CLIENT_ID.isBlank()) return false
        val status = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context)
        return status == ConnectionResult.SUCCESS
    }

    suspend fun getIdToken(activityContext: Context): AppResult<String> {
        if (!isAvailable()) {
            return AppResult.Err(
                AppError.Unknown("Google sign-in isn't available on this device."),
            )
        }
        return try {
            val option = GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(false)
                .setServerClientId(BuildConfig.GOOGLE_WEB_CLIENT_ID)
                .setAutoSelectEnabled(true)
                .build()
            val request = GetCredentialRequest.Builder()
                .addCredentialOption(option)
                .build()
            val result = CredentialManager.create(activityContext)
                .getCredential(activityContext, request)
            val credential = result.credential
            if (credential is CustomCredential &&
                credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
            ) {
                val token = GoogleIdTokenCredential.createFrom(credential.data).idToken
                if (token.isBlank()) {
                    AppResult.Err(AppError.Unknown("Google sign-in didn't go through. Try again, or sign in with email."))
                } else {
                    AppResult.Ok(token)
                }
            } else {
                AppResult.Err(AppError.Unknown("Google sign-in didn't go through. Try again, or sign in with email."))
            }
        } catch (_: GetCredentialCancellationException) {
            AppResult.Err(AppError.Cancelled())
        } catch (error: Exception) {
            AppResult.Err(
                AppError.Unknown(
                    error.message?.takeIf { it.isNotBlank() }
                        ?: "Google sign-in didn't go through. Try again, or sign in with email.",
                ),
            )
        }
    }
}
