package com.dhama.mybase

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.emptyPreferences
import com.dhama.mybase.core.age.AGE_SEAL_PREFIX
import com.dhama.mybase.core.age.AgeSeal
import com.dhama.mybase.core.age.acceptsSealedAge
import com.dhama.mybase.core.data.AgeLocalStore
import com.dhama.mybase.core.data.DataStoreRepo
import com.dhama.mybase.core.data.KeystoreAgeSeal
import com.dhama.mybase.core.utils.PreferencesKeys
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Base64

class AgeLocalStoreTest {

    private val dob = "1991-03-17"
    private val confirmedAt = "2026-10-12T15:04:05Z"

    @Test
    fun plaintextDateIsRejectedBeforeItCanBeStored() {
        assertFalse(acceptsSealedAge(dob, dob))
        assertFalse(acceptsSealedAge(dob, "$AGE_SEAL_PREFIX$dob"))
        assertNull(KeystoreAgeSeal().open(dob))
        assertNull(KeystoreAgeSeal().open("$AGE_SEAL_PREFIX!!!"))
        val shortIv = AGE_SEAL_PREFIX + Base64.getEncoder().encodeToString(byteArrayOf(5))
        assertNull(KeystoreAgeSeal().open(shortIv))
    }

    @Test
    fun saveStoresCiphertextAndClearRemovesTheAttestation() = runBlocking {
        val preferences = MemoryPreferences()
        val seal = ReversibleSeal()
        val store = AgeLocalStore(DataStoreRepo(preferences), seal)

        assertTrue(store.save("user-a", dob, confirmedAt))
        val stored = preferences.state.value.asMap().values.joinToString()
        assertFalse(stored.contains(dob))
        assertEquals(dob, store.read().dateOfBirth)
        assertTrue(store.read().confirmed)
        assertEquals("user-a", store.read().subject)

        store.clear()
        assertTrue(seal.discarded)
        val after = store.read()
        assertEquals("", after.dateOfBirth)
        assertFalse(after.confirmed)
        assertEquals("", after.confirmedAt)
        assertEquals("", after.subject)
        assertEquals("", preferences.value(PreferencesKeys.DATE_OF_BIRTH))
        assertEquals("", preferences.value(PreferencesKeys.DATE_OF_BIRTH_SEALED))
    }

    @Test
    fun aSealThatReturnsTheRawDateIsNotWritten() = runBlocking {
        val preferences = MemoryPreferences()
        val store = AgeLocalStore(DataStoreRepo(preferences), IdentitySeal)
        assertFalse(store.save("user-a", dob, confirmedAt))
        val stored = preferences.state.value.asMap().values.joinToString()
        assertFalse(stored.contains(dob))
        assertEquals("", store.read().dateOfBirth)
        assertFalse(store.read().confirmed)
    }

    @Test
    fun legacyPlaintextIsSealedAndThenRemoved() = runBlocking {
        val preferences = MemoryPreferences()
        val repo = DataStoreRepo(preferences)
        repo.saveString(PreferencesKeys.DATE_OF_BIRTH, dob)
        repo.saveBoolean(PreferencesKeys.AGE_CONFIRMED, true)
        val store = AgeLocalStore(repo, ReversibleSeal())

        assertEquals(dob, store.read().dateOfBirth)
        assertEquals("", preferences.value(PreferencesKeys.DATE_OF_BIRTH))
        val sealed = preferences.value(PreferencesKeys.DATE_OF_BIRTH_SEALED)
        assertTrue(sealed.startsWith(AGE_SEAL_PREFIX))
        assertFalse(sealed.contains(dob))
    }

    private class MemoryPreferences : DataStore<Preferences> {
        val state = MutableStateFlow<Preferences>(emptyPreferences())
        override val data: Flow<Preferences> = state
        override suspend fun updateData(transform: suspend (t: Preferences) -> Preferences): Preferences {
            val next = transform(state.value)
            state.value = next
            return next
        }

        suspend fun value(key: Preferences.Key<String>): String {
            return state.value[key].orEmpty()
        }
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

    private object IdentitySeal : AgeSeal {
        override fun seal(plaintext: String) = plaintext
        override fun open(sealed: String): String? = sealed
        override fun discard() = Unit
    }
}
