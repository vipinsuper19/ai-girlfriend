package com.dhama.mybase.core.data

import com.dhama.mybase.core.network.dataElement
import com.google.firebase.auth.EmailAuthProvider
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.google.firebase.auth.FirebaseAuthRecentLoginRequiredException
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.PhoneAuthProvider
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlin.coroutines.cancellation.CancellationException

/** Android Auth error code when Admin SDK (or another client) already removed the user. */
internal const val FIREBASE_USER_NOT_FOUND = "ERROR_USER_NOT_FOUND"

/**
 * Sign-in methods this app can start.
 * Email and Google are enabled. Phone exists in the client and stays off unless the feature flag is on.
 */
enum class LinkedSignIn {
    None,
    Email,
    Google,
    Phone,
    Unsupported,
}

internal class RecentLoginNeedsCredential(val provider: LinkedSignIn) : Exception()

/**
 * `DELETE /users/me` does not delete the Firebase Auth user today.
 * A future response can set `data.firebaseUserDeleted` when the Admin SDK already removed it.
 */
internal fun firebaseAuthUserDeletedByAdmin(body: String): Boolean {
    val data = runCatching { dataElement(body) }.getOrNull() as? JsonObject ?: return false
    val flag = data["firebaseUserDeleted"] as? JsonPrimitive ?: return false
    return flag.booleanOrNull == true
}

/**
 * Prefer email when both email and Google are linked: either credential refreshes the session,
 * and the delete dialog can collect a password. Phone is only selectable when that sign-in is on.
 */
internal fun deletionProvider(providerIds: Collection<String>, phoneSignIn: Boolean): LinkedSignIn {
    val ids = providerIds.toSet()
    return when {
        EmailAuthProvider.PROVIDER_ID in ids -> LinkedSignIn.Email
        GoogleAuthProvider.PROVIDER_ID in ids -> LinkedSignIn.Google
        PhoneAuthProvider.PROVIDER_ID in ids && phoneSignIn -> LinkedSignIn.Phone
        PhoneAuthProvider.PROVIDER_ID in ids -> LinkedSignIn.Unsupported
        else -> LinkedSignIn.Unsupported
    }
}

/**
 * Deletes [FirebaseAuth.getCurrentUser].
 * A recent-login error reauthenticates once and retries. User-not-found is success only when
 * [serverDeletedFirebaseUser] says the Admin SDK already removed the account.
 */
internal suspend fun deleteSignedInFirebaseUser(
    auth: FirebaseAuth,
    serverDeletedFirebaseUser: Boolean,
    reauthenticate: suspend (FirebaseUser) -> Unit,
) {
    val user = auth.currentUser
    if (user == null) {
        if (serverDeletedFirebaseUser) return
        throw IllegalStateException(ACCOUNT_DELETE_ERROR)
    }
    try {
        user.delete().await()
    } catch (error: CancellationException) {
        throw error
    } catch (error: FirebaseAuthRecentLoginRequiredException) {
        reauthenticate(user)
        try {
            user.delete().await()
        } catch (retry: CancellationException) {
            throw retry
        } catch (retry: FirebaseAuthInvalidUserException) {
            if (!missingUserAlreadyDeleted(retry, serverDeletedFirebaseUser)) throw retry
        }
    } catch (error: FirebaseAuthInvalidUserException) {
        if (!missingUserAlreadyDeleted(error, serverDeletedFirebaseUser)) throw error
    }
}

internal fun missingUserAlreadyDeleted(
    error: FirebaseAuthInvalidUserException,
    serverDeletedFirebaseUser: Boolean,
): Boolean = serverDeletedFirebaseUser && error.errorCode == FIREBASE_USER_NOT_FOUND
