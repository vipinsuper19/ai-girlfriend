package com.dhama.mybase.core.data

import com.dhama.mybase.core.network.ApiStatusException
import kotlin.coroutines.cancellation.CancellationException

internal const val ACCOUNT_DELETE_ERROR = "Couldn't delete your account."
internal const val ACCOUNT_DELETE_SIGN_IN = "Sign in again to delete this account."

/** ApiStatusException.code for a 401 on DELETE /users/me after token refresh fails. */
internal const val ACCOUNT_DELETE_SIGN_IN_CODE = "ACCOUNT_DELETE_SIGN_IN"

/**
 * Preference names the 18+ gate and first-chat disclosure will write (PR #8, not on main yet).
 * Deletion removes them by name. Per-uid variants use `_`, `.`, or `:` after the base name,
 * for example `date_of_birth_<uid>` and `age_confirmed_18.<uid>`.
 */
internal val ACCOUNT_DELETION_PREFERENCE_NAMES = setOf(
    "age_confirmed_18",
    "date_of_birth",
    "age_confirmed_at",
    "age_subject",
    "ai_disclosure_acknowledged",
)

internal fun isAccountDeletionPreference(name: String): Boolean {
    if (name in ACCOUNT_DELETION_PREFERENCE_NAMES) return true
    return ACCOUNT_DELETION_PREFERENCE_NAMES.any { base ->
        name.startsWith("${base}_") || name.startsWith("$base.") || name.startsWith("$base:")
    }
}

/**
 * Calls DELETE /users/me.
 *
 * A 404 from DELETE /users/me counts as success: the account is already gone, so this phone
 * can still sign out and wipe local data. Any other status, including a 401 that is not the
 * refresh-failure signal, is thrown for the caller to handle.
 */
internal suspend fun deleteServerAccount(
    hasSession: Boolean,
    delete: suspend () -> Unit,
) {
    if (!hasSession) {
        throw ApiStatusException(401, ACCOUNT_DELETE_SIGN_IN, null)
    }
    try {
        delete()
    } catch (error: CancellationException) {
        throw error
    } catch (error: ApiStatusException) {
        // A 404 from DELETE /users/me counts as success.
        if (error.status != 404) throw error
    }
}

sealed interface AccountDeletionResult {
    data object Deleted : AccountDeletionResult

    /** DELETE /users/me returned 401 after the refresh token was rejected. */
    data object SignIn : AccountDeletionResult

    data class Failed(val message: String) : AccountDeletionResult
}

internal sealed interface SignInRoute {
    data object OpenSignIn : SignInRoute
    data class Stay(val message: String) : SignInRoute
}

/**
 * Deletes the account on the server, then signs out and wipes this phone.
 * A failed server delete leaves the local session in place.
 */
internal suspend fun performAccountDeletion(
    deleteRemote: suspend () -> Unit,
    signOut: suspend () -> Unit,
    clearLocal: suspend () -> Unit,
): AccountDeletionResult {
    try {
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
        signOut()
    } catch (error: CancellationException) {
        throw error
    } catch (_: Exception) {
        // The server account is already gone. Still wipe this phone.
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

private fun accountDeletionMessage(error: Exception): String =
    error.message?.trim()?.takeIf { it.isNotEmpty() } ?: ACCOUNT_DELETE_ERROR

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
