package com.dhama.mybase.core.data

import com.dhama.mybase.core.network.ApiStatusException
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import kotlin.coroutines.cancellation.CancellationException

internal const val ACCOUNT_DELETE_ERROR = "Couldn't delete your account."
internal const val ACCOUNT_DELETE_SIGN_IN = "Sign in again to delete this account."

/** ApiStatusException.code for a 401 on DELETE /users/me after token refresh fails. */
internal const val ACCOUNT_DELETE_SIGN_IN_CODE = "ACCOUNT_DELETE_SIGN_IN"

/**
 * Calls DELETE /users/me.
 *
 * A 404 from DELETE /users/me counts as success: the account is already gone, so this phone
 * can still sign out and wipe local data. Any other status, including a 401 that is not the
 * refresh-failure signal, is thrown for the caller to handle.
 */
internal suspend fun deleteServerAccount(
    hasSession: Boolean,
    delete: suspend () -> Boolean,
): Boolean {
    if (!hasSession) {
        throw ApiStatusException(401, ACCOUNT_DELETE_SIGN_IN, null)
    }
    return try {
        delete()
    } catch (error: CancellationException) {
        throw error
    } catch (error: ApiStatusException) {
        // A 404 from DELETE /users/me counts as success. The body is gone, so the
        // Admin SDK flag is unknown and Firebase deletion still has to be attempted.
        if (error.status != 404) throw error
        false
    }
}

sealed interface AccountDeletionResult {
    data object Deleted : AccountDeletionResult

    /** DELETE /users/me returned 401 after the refresh token was rejected. */
    data object SignIn : AccountDeletionResult

    /** Firebase refused delete() until the user signs in again with the linked provider. */
    data class NeedsRecentLogin(val provider: LinkedSignIn) : AccountDeletionResult

    data class Failed(val message: String) : AccountDeletionResult
}

internal sealed interface SignInRoute {
    data object OpenSignIn : SignInRoute
    data class Stay(val message: String) : SignInRoute
}

/**
 * Deletes the server account, then the Firebase Auth user, then this phone.
 * A failed server delete or a failed Firebase delete leaves Room, prefs, and the age seal in place.
 * [deleteRemote] returns whether the response says the Admin SDK already deleted the Firebase user.
 */
internal suspend fun performAccountDeletion(
    deleteRemote: suspend () -> Boolean,
    deleteFirebaseUser: suspend (serverDeletedFirebaseUser: Boolean) -> Unit = { _ -> },
    signOut: suspend () -> Unit,
    clearLocal: suspend () -> Unit,
): AccountDeletionResult {
    val serverDeletedFirebaseUser = try {
        deleteRemote()
    } catch (error: CancellationException) {
        throw error
    } catch (error: Exception) {
        if (error is ApiStatusException && error.code == ACCOUNT_DELETE_SIGN_IN_CODE) {
            return AccountDeletionResult.SignIn
        }
        return AccountDeletionResult.Failed(accountDeletionMessage(error))
    }
    try {
        deleteFirebaseUser(serverDeletedFirebaseUser)
    } catch (error: CancellationException) {
        throw error
    } catch (error: RecentLoginNeedsCredential) {
        return AccountDeletionResult.NeedsRecentLogin(error.provider)
    } catch (error: Exception) {
        return AccountDeletionResult.Failed(accountDeletionMessage(error))
    }
    try {
        signOut()
    } catch (error: CancellationException) {
        throw error
    } catch (_: Exception) {
        // The server account and the Firebase user are already gone. Still wipe this phone.
    }
    return try {
        clearLocal()
        AccountDeletionResult.Deleted
    } catch (error: CancellationException) {
        throw error
    } catch (error: Exception) {
        AccountDeletionResult.Failed(accountDeletionMessage(error))
    }
}

private fun accountDeletionMessage(error: Exception): String {
    if (error is FirebaseAuthInvalidCredentialsException) return "Couldn't confirm it's you. Try again."
    if (error is FirebaseAuthException) return ACCOUNT_DELETE_ERROR
    return error.message?.trim()?.takeIf { it.isNotEmpty() } ?: ACCOUNT_DELETE_ERROR
}

/**
 * Signs Firebase out first. The session store is cleared only after Firebase is signed out.
 * Returns false when Firebase is still signed in, and does not touch the session store.
 */
internal suspend fun signOutThenClearSession(
    firebaseSignedIn: () -> Boolean,
    signOutFirebase: suspend () -> Unit,
    clearSessionStore: suspend () -> Unit,
): Boolean {
    if (firebaseSignedIn()) {
        signOutFirebase()
    }
    if (firebaseSignedIn()) return false
    clearSessionStore()
    return true
}

/**
 * After a 401 on DELETE /users/me whose refresh failed: open sign-in only once Firebase
 * is signed out and the session store has been cleared.
 */
internal suspend fun routeAfterFailedDeleteRefresh(
    signOutThenClear: suspend () -> Boolean,
    clearLoggedInFlag: suspend () -> Unit,
): SignInRoute {
    val cleared = try {
        signOutThenClear()
    } catch (error: CancellationException) {
        throw error
    } catch (_: Exception) {
        false
    }
    if (!cleared) return SignInRoute.Stay(ACCOUNT_DELETE_SIGN_IN)
    clearLoggedInFlag()
    return SignInRoute.OpenSignIn
}
