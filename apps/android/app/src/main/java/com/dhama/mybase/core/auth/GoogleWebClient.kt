package com.dhama.mybase.core.auth

import android.content.Context
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialResponse
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException

/**
 * Web client id written by the Google Services plugin from google-services.json.
 * Empty when that file was not present at build time, so the app still compiles.
 */
fun googleWebClientId(context: Context): String {
    val resId = context.resources.getIdentifier("default_web_client_id", "string", context.packageName)
    if (resId == 0) return ""
    return context.getString(resId)
}

/** ID token from a Credential Manager Google response. Null when the response is not a Google ID token. */
fun googleIdToken(result: GetCredentialResponse): String? {
    val credential = result.credential
    if (credential !is CustomCredential || credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
        return null
    }
    return try {
        GoogleIdTokenCredential.createFrom(credential.data).idToken.takeIf { it.isNotBlank() }
    } catch (_: GoogleIdTokenParsingException) {
        null
    }
}
