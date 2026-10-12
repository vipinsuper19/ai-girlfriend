package com.dhama.mybase

import com.dhama.mybase.core.data.ACCOUNT_DELETE_ERROR
import com.dhama.mybase.core.data.ACCOUNT_DELETE_SIGN_IN
import com.dhama.mybase.core.data.ACCOUNT_DELETE_SIGN_IN_CODE
import com.dhama.mybase.core.data.AccountDeletionResult
import com.dhama.mybase.core.data.AgeLocalStore
import com.dhama.mybase.core.data.DataStoreRepo
import com.dhama.mybase.core.data.SignInRoute
import com.dhama.mybase.core.data.deleteServerAccount
import com.dhama.mybase.core.data.performAccountDeletion
import com.dhama.mybase.core.data.routeAfterFailedDeleteRefresh
import com.dhama.mybase.core.data.signOutThenClearSession
import com.dhama.mybase.core.age.AGE_SEAL_PREFIX
import com.dhama.mybase.core.age.AgeSeal
import com.dhama.mybase.core.network.ApiStatusException
import com.dhama.mybase.core.utils.PreferencesKeys
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.emptyPreferences
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
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

    @Test
    fun deleteUsersMe404CountsAsSuccess() = runBlocking {
        var signedOut = false
        var cleared = false
        val result = performAccountDeletion(
            deleteRemote = {
                deleteServerAccount(hasSession = true) {
                    throw ApiStatusException(404, "User not found", null)
                }
            },
            signOut = { signedOut = true },
            clearLocal = { cleared = true },
        )
        assertEquals(AccountDeletionResult.Deleted, result)
        assertTrue(signedOut)
        assertTrue(cleared)
    }

    @Test
    fun delete401AfterFailedRefreshIsTheSignInState() = runBlocking {
        var signedOut = false
        var cleared = false
        val result = performAccountDeletion(
            deleteRemote = {
                throw ApiStatusException(401, "expired", ACCOUNT_DELETE_SIGN_IN_CODE)
            },
            signOut = { signedOut = true },
            clearLocal = { cleared = true },
        )
        assertEquals(AccountDeletionResult.SignIn, result)
        assertFalse(signedOut)
        assertFalse(cleared)
    }

    @Test
    fun plain401DoesNotRouteToSignIn() = runBlocking {
        val result = performAccountDeletion(
            deleteRemote = { throw ApiStatusException(401, "Sign in with email to reach her on the server.", null) },
            signOut = { fail("signed out") },
            clearLocal = { fail("cleared") },
        )
        assertEquals(
            AccountDeletionResult.Failed("Sign in with email to reach her on the server."),
            result,
        )
    }

    @Test
    fun signInRouteClearsTheSessionOnlyAfterFirebaseSignsOut() = runBlocking {
        var firebase = true
        val order = mutableListOf<String>()
        val cleared = signOutThenClearSession(
            firebaseSignedIn = { firebase },
            signOutFirebase = {
                order += "firebase"
                firebase = false
            },
            clearSessionStore = { order += "session" },
        )
        assertTrue(cleared)
        assertEquals(listOf("firebase", "session"), order)
    }

    @Test
    fun signInRouteLeavesTheSessionStoreWhenFirebaseStaysSignedIn() = runBlocking {
        var clearedStore = false
        val cleared = signOutThenClearSession(
            firebaseSignedIn = { true },
            signOutFirebase = {},
            clearSessionStore = { clearedStore = true },
        )
        assertFalse(cleared)
        assertFalse(clearedStore)
    }

    @Test
    fun failedRefreshOpensSignInAfterTheSessionIsCleared() = runBlocking {
        var flagged = true
        val route = routeAfterFailedDeleteRefresh(
            signOutThenClear = { true },
            clearLoggedInFlag = { flagged = false },
        )
        assertEquals(SignInRoute.OpenSignIn, route)
        assertFalse(flagged)
    }

    @Test
    fun failedRefreshStaysPutWhenTheSessionCannotBeCleared() = runBlocking {
        var flagged = true
        val route = routeAfterFailedDeleteRefresh(
            signOutThenClear = { false },
            clearLoggedInFlag = { flagged = false },
        )
        assertEquals(SignInRoute.Stay(ACCOUNT_DELETE_SIGN_IN), route)
        assertTrue(flagged)
    }

    @Test
    fun failedServerDeleteKeepsTheSessionAndDoesNotWipeAgeData() = runBlocking {
        var ageCleared = false
        var signedOut = false
        val result = performAccountDeletion(
            deleteRemote = { throw ApiStatusException(503, "Server unavailable", null) },
            signOut = { signedOut = true },
            clearLocal = { ageCleared = true },
        )
        assertEquals(AccountDeletionResult.Failed("Server unavailable"), result)
        assertFalse(signedOut)
        assertFalse(ageCleared)
    }

    @Test
    fun successfulDeleteClearsTheAgeKeystoreKeyAndDisclosure() = runBlocking {
        val preferences = MemoryPreferences()
        val repo = DataStoreRepo(preferences)
        val seal = ReversibleSeal()
        val age = AgeLocalStore(repo, seal)
        repo.saveBoolean(PreferencesKeys.AI_DISCLOSURE_ACKNOWLEDGED, true)
        assertTrue(age.save("user-a", "1991-03-17", "2026-10-12T15:04:05Z"))

        var signedOut = false
        val result = performAccountDeletion(
            deleteRemote = {},
            signOut = { signedOut = true },
            clearLocal = {
                age.clear()
                repo.update { prefs -> prefs.remove(PreferencesKeys.AI_DISCLOSURE_ACKNOWLEDGED) }
            },
        )

        assertEquals(AccountDeletionResult.Deleted, result)
        assertTrue(signedOut)
        assertTrue(seal.discarded)
        assertEquals("", preferences.value(PreferencesKeys.DATE_OF_BIRTH_SEALED))
        assertEquals(false, preferences.state.value[PreferencesKeys.AGE_CONFIRMED] ?: false)
        assertEquals(false, preferences.state.value[PreferencesKeys.AI_DISCLOSURE_ACKNOWLEDGED] ?: false)
    }

    private class MemoryPreferences : DataStore<Preferences> {
        val state = MutableStateFlow<Preferences>(emptyPreferences())
        override val data: Flow<Preferences> = state
        override suspend fun updateData(transform: suspend (t: Preferences) -> Preferences): Preferences {
            val next = transform(state.value)
            state.value = next
            return next
        }

        suspend fun value(key: Preferences.Key<String>): String = state.value[key].orEmpty()
    }

    private class ReversibleSeal : AgeSeal {
        private val box = linkedMapOf<String, String>()
        private var next = 0
        var discarded = false
        override fun seal(plaintext: String): String {
            val token = "$AGE_SEAL_PREFIX" + "t${next++}"
            box[token] = plaintext
            return token
        }

        override fun open(sealed: String): String? = box[sealed]

        override fun discard() {
            discarded = true
            box.clear()
        }
    }
}
