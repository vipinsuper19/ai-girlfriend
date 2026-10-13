package com.dhama.mybase

import com.dhama.mybase.core.data.ACCOUNT_DELETE_ERROR
import com.dhama.mybase.core.data.deleteSignedInFirebaseUser
import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.google.firebase.auth.FirebaseAuthRecentLoginRequiredException
import com.google.firebase.auth.FirebaseUser
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.mockito.Mockito.`when`

class FirebaseAccountDeletionTest {

    @Test
    fun deleteSucceedsWithoutReauthentication() = runBlocking {
        val auth = mock(FirebaseAuth::class.java)
        val user = mock(FirebaseUser::class.java)
        `when`(auth.currentUser).thenReturn(user)
        `when`(user.delete()).thenReturn(Tasks.forResult<Void>(null))

        var reauthenticated = false
        deleteSignedInFirebaseUser(auth, serverDeletedFirebaseUser = false) {
            reauthenticated = true
        }

        assertTrue(!reauthenticated)
        verify(user, times(1)).delete()
        Unit
    }

    @Test
    fun recentLoginReauthenticatesOnceAndRetriesDelete() = runBlocking {
        val auth = mock(FirebaseAuth::class.java)
        val user = mock(FirebaseUser::class.java)
        `when`(auth.currentUser).thenReturn(user)
        val recent = FirebaseAuthRecentLoginRequiredException("ERROR_REQUIRES_RECENT_LOGIN", "recent login required")
        `when`(user.delete()).thenReturn(Tasks.forException<Void>(recent), Tasks.forResult<Void>(null))

        var reauthenticated = false
        deleteSignedInFirebaseUser(auth, serverDeletedFirebaseUser = false) {
            reauthenticated = true
        }

        assertTrue(reauthenticated)
        verify(user, times(2)).delete()
        Unit
    }

    @Test
    fun reauthenticationFailureDoesNotRetryDeleteOrHideTheError() = runBlocking {
        val auth = mock(FirebaseAuth::class.java)
        val user = mock(FirebaseUser::class.java)
        `when`(auth.currentUser).thenReturn(user)
        val recent = FirebaseAuthRecentLoginRequiredException("ERROR_REQUIRES_RECENT_LOGIN", "recent login required")
        `when`(user.delete()).thenReturn(Tasks.forException<Void>(recent))

        try {
            deleteSignedInFirebaseUser(auth, serverDeletedFirebaseUser = false) {
                throw IllegalStateException("no credential")
            }
            fail("expected reauth failure")
        } catch (error: IllegalStateException) {
            assertEquals("no credential", error.message)
        }
        verify(user, times(1)).delete()
        Unit
    }

    @Test
    fun userNotFoundIsSuccessWhenTheServerAlreadyDeletedTheFirebaseUser() = runBlocking {
        val auth = mock(FirebaseAuth::class.java)
        val user = mock(FirebaseUser::class.java)
        `when`(auth.currentUser).thenReturn(user)
        val missing = FirebaseAuthInvalidUserException("ERROR_USER_NOT_FOUND", "user-not-found")
        `when`(user.delete()).thenReturn(Tasks.forException<Void>(missing))

        var reauthenticated = false
        deleteSignedInFirebaseUser(auth, serverDeletedFirebaseUser = true) {
            reauthenticated = true
        }

        assertTrue(!reauthenticated)
        verify(user, times(1)).delete()
        Unit
    }

    @Test
    fun userNotFoundWithoutTheServerFlagIsAnError() = runBlocking {
        val auth = mock(FirebaseAuth::class.java)
        val user = mock(FirebaseUser::class.java)
        `when`(auth.currentUser).thenReturn(user)
        val missing = FirebaseAuthInvalidUserException("ERROR_USER_NOT_FOUND", "user-not-found")
        `when`(user.delete()).thenReturn(Tasks.forException<Void>(missing))

        try {
            deleteSignedInFirebaseUser(auth, serverDeletedFirebaseUser = false) {
                fail("reauthenticated")
            }
            fail("expected user-not-found")
        } catch (error: FirebaseAuthInvalidUserException) {
            assertEquals("ERROR_USER_NOT_FOUND", error.errorCode)
        }
    }

    @Test
    fun userNotFoundAfterReauthIsSuccessOnlyWithTheServerFlag() = runBlocking {
        val auth = mock(FirebaseAuth::class.java)
        val user = mock(FirebaseUser::class.java)
        `when`(auth.currentUser).thenReturn(user)
        val recent = FirebaseAuthRecentLoginRequiredException("ERROR_REQUIRES_RECENT_LOGIN", "recent login required")
        val missing = FirebaseAuthInvalidUserException("ERROR_USER_NOT_FOUND", "user-not-found")
        `when`(user.delete()).thenReturn(Tasks.forException<Void>(recent), Tasks.forException<Void>(missing))

        deleteSignedInFirebaseUser(auth, serverDeletedFirebaseUser = true) { _ -> }
        verify(user, times(2)).delete()

        `when`(user.delete()).thenReturn(Tasks.forException<Void>(recent), Tasks.forException<Void>(missing))
        try {
            deleteSignedInFirebaseUser(auth, serverDeletedFirebaseUser = false) { _ -> }
            fail("expected user-not-found")
        } catch (error: FirebaseAuthInvalidUserException) {
            assertEquals("ERROR_USER_NOT_FOUND", error.errorCode)
        }
    }

    @Test
    fun missingLocalUserFailsUnlessTheServerAlreadyDeletedFirebase() = runBlocking {
        val auth = mock(FirebaseAuth::class.java)
        `when`(auth.currentUser).thenReturn(null)

        deleteSignedInFirebaseUser(auth, serverDeletedFirebaseUser = true) { fail("reauthenticated") }

        try {
            deleteSignedInFirebaseUser(auth, serverDeletedFirebaseUser = false) { fail("reauthenticated") }
            fail("expected missing user")
        } catch (error: IllegalStateException) {
            assertEquals(ACCOUNT_DELETE_ERROR, error.message)
        }
    }
}
