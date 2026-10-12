package com.dhama.mybase.core.data

import com.dhama.mybase.core.network.ApiStatusException
import kotlin.coroutines.cancellation.CancellationException

internal const val ACCOUNT_DELETE_ERROR = "Couldn't delete your account."
internal const val ACCOUNT_DELETE_SIGN_IN = "Sign in again to delete this account."

/**
 * Calls the server delete-account endpoint.
 * A missing account (404) is success so this phone can still sign out after a retry.
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
        if (error.status != 404) throw error
    }
}

sealed interface AccountDeletionResult {
    data object Deleted : AccountDeletionResult
    data class Failed(val message: String) : AccountDeletionResult
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
