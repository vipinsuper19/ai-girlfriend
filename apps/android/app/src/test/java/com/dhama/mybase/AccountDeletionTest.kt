package com.dhama.mybase

import com.dhama.mybase.core.data.ACCOUNT_DELETE_ERROR
import com.dhama.mybase.core.data.ACCOUNT_DELETE_SIGN_IN
import com.dhama.mybase.core.data.AccountDeletionResult
import com.dhama.mybase.core.data.deleteServerAccount
import com.dhama.mybase.core.data.performAccountDeletion
import com.dhama.mybase.core.network.ApiStatusException
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import kotlin.coroutines.cancellation.CancellationException

/**
 * SettingsViewModel.deleteAccount and AuthRepoImpl.deleteRemoteAccount both go through
 * these steps: call DELETE users/me, then sign out (tokens) and wipe local data.
 */
class AccountDeletionTest {

    @Test
    fun settingsDeletionSignsOutOnlyAfterTheServerDeletesTheAccount() = runBlocking {
        val order = mutableListOf<String>()
        val result = performAccountDeletion(
            deleteRemote = { order += "delete" },
            signOut = { order += "signOut" },
            clearLocal = { order += "clear" },
        )
        assertEquals(AccountDeletionResult.Deleted, result)
        assertEquals(listOf("delete", "signOut", "clear"), order)
    }

    @Test
    fun settingsDeletionKeepsTheSessionWhenTheServerRefuses() = runBlocking {
        var signedOut = false
        var cleared = false
        val result = performAccountDeletion(
            deleteRemote = { throw ApiStatusException(503, "Server unavailable", null) },
            signOut = { signedOut = true },
            clearLocal = { cleared = true },
        )
        assertEquals(AccountDeletionResult.Failed("Server unavailable"), result)
        assertFalse(signedOut)
        assertFalse(cleared)
    }

    @Test
    fun settingsDeletionUsesAFallbackMessageWhenTheFailureHasNoText() = runBlocking {
        val result = performAccountDeletion(
            deleteRemote = { throw Exception("   ") },
            signOut = { fail("signed out") },
            clearLocal = { fail("cleared") },
        )
        assertEquals(AccountDeletionResult.Failed(ACCOUNT_DELETE_ERROR), result)
    }

    @Test
    fun settingsDeletionStillWipesThePhoneWhenSignOutFailsAfterTheServerDelete() = runBlocking {
        var cleared = false
        val result = performAccountDeletion(
            deleteRemote = {},
            signOut = { throw IllegalStateException("token store") },
            clearLocal = { cleared = true },
        )
        assertTrue(cleared)
        assertEquals(AccountDeletionResult.Deleted, result)
    }

    @Test
    fun settingsDeletionReportsALocalWipeFailureAfterTheServerDelete() = runBlocking {
        var signedOut = false
        val result = performAccountDeletion(
            deleteRemote = {},
            signOut = { signedOut = true },
            clearLocal = { throw IllegalStateException("database locked") },
        )
        assertTrue(signedOut)
        assertEquals(AccountDeletionResult.Failed("database locked"), result)
    }

    @Test
    fun settingsDeletionDoesNotTurnCancellationIntoAnError() {
        try {
            runBlocking {
                performAccountDeletion(
                    deleteRemote = { throw CancellationException("left settings") },
                    signOut = { fail("signed out") },
                    clearLocal = { fail("cleared") },
                )
            }
            fail("expected cancellation")
        } catch (error: CancellationException) {
            assertEquals("left settings", error.message)
        }
    }

    @Test
    fun repositoryDeleteCallsTheEndpointWhenASessionExists() = runBlocking {
        var called = false
        deleteServerAccount(hasSession = true) { called = true }
        assertTrue(called)
    }

    @Test
    fun repositoryDeleteDoesNotCallTheEndpointWithoutASession() {
        try {
            runBlocking {
                deleteServerAccount(hasSession = false) { fail("called delete") }
            }
            fail("expected missing session")
        } catch (error: ApiStatusException) {
            assertEquals(401, error.status)
            assertEquals(ACCOUNT_DELETE_SIGN_IN, error.message)
        }
    }

    @Test
    fun repositoryDeleteTreatsAMissingAccountAsAlreadyDeleted() = runBlocking {
        var called = false
        deleteServerAccount(hasSession = true) {
            called = true
            throw ApiStatusException(404, "User not found", null)
        }
        assertTrue(called)
    }

    @Test
    fun repositoryDeletePropagatesServerErrors() {
        try {
            runBlocking {
                deleteServerAccount(hasSession = true) {
                    throw ApiStatusException(500, "nope", "DELETE_FAILED")
                }
            }
            fail("expected server error")
        } catch (error: ApiStatusException) {
            assertEquals(500, error.status)
            assertEquals("DELETE_FAILED", error.code)
        }
    }
}
