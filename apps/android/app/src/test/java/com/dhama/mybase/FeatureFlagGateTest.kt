package com.dhama.mybase

import android.app.Activity
import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.emptyPreferences
import com.dhama.mybase.core.FeatureFlags
import com.dhama.mybase.core.billing.PlayBilling
import com.dhama.mybase.core.billing.PlayOffer
import com.dhama.mybase.core.data.AccountSync
import com.dhama.mybase.core.data.DataStoreRepo
import com.dhama.mybase.core.data.PushRegistration
import com.dhama.mybase.core.network.ApiClient
import com.dhama.mybase.core.network.ApiStatusException
import com.dhama.mybase.core.network.SessionStore
import com.dhama.mybase.core.network.SessionTokens
import com.dhama.mybase.ui.onboarding.WizardStep
import com.dhama.mybase.ui.onboarding.next
import com.dhama.mybase.ui.onboarding.previous
import com.dhama.mybase.ui.onboarding.progressIndex
import com.dhama.mybase.ui.onboarding.wizardStepTotal
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.mockito.Mockito.mock

class FeatureFlagGateTest {

    @Test
    fun wizardSkipsVoiceWhenTheFlagIsOffAndKeepsItWhenOn() {
        assertEquals(WizardStep.Finalize, WizardStep.Personality.next(voiceEnabled = false))
        assertEquals(WizardStep.Personality, WizardStep.Finalize.previous(voiceEnabled = false))
        assertNull(WizardStep.Intro.previous(voiceEnabled = false))
        assertEquals(WizardStep.Appearance, WizardStep.Intro.next(voiceEnabled = false))
        assertEquals(1, WizardStep.Appearance.progressIndex(voiceEnabled = false))
        assertEquals(2, WizardStep.Personality.progressIndex(voiceEnabled = false))
        assertEquals(3, WizardStep.Finalize.progressIndex(voiceEnabled = false))
        assertEquals(3, wizardStepTotal(voiceEnabled = false))

        assertEquals(WizardStep.Voice, WizardStep.Personality.next(voiceEnabled = true))
        assertEquals(WizardStep.Finalize, WizardStep.Voice.next(voiceEnabled = true))
        assertEquals(WizardStep.Voice, WizardStep.Finalize.previous(voiceEnabled = true))
        assertEquals(WizardStep.Personality, WizardStep.Voice.previous(voiceEnabled = true))
        assertEquals(3, WizardStep.Voice.progressIndex(voiceEnabled = true))
        assertEquals(4, WizardStep.Finalize.progressIndex(voiceEnabled = true))
        assertEquals(4, wizardStepTotal(voiceEnabled = true))
    }

    @Test
    fun pushRegistrationStopsBeforeTheNetworkWhenPushIsOff() = runBlocking {
        val session = CountingSession()
        val preferences = CountingPreferences()
        val registration = registration(session, preferences, push = false)

        assertFalse(registration.available())
        registration.enable()
        registration.disable()
        registration.onNewToken("token")
        registration.forgetDevice()

        assertEquals(0, session.reads)
        assertEquals(0, preferences.writes)
        assertEquals(0, preferences.reads)
    }

    @Test
    fun pushRegistrationReachesTheSessionWhenPushIsOn() = runBlocking {
        val session = CountingSession()
        val preferences = CountingPreferences()
        val registration = registration(session, preferences, push = true)

        assertFalse(registration.available())
        try {
            registration.enable()
            fail("enable should ask for a session")
        } catch (error: ApiStatusException) {
            assertEquals(401, error.status)
        }
        registration.disable()
        registration.forgetDevice()
        val enabled = registration.observeEnabled().first()
        registration.onNewToken("token")

        assertTrue(session.reads > 0)
        assertTrue(preferences.writes > 0)
        assertFalse(enabled)
        assertTrue(preferences.reads > 0)
    }

    @Test
    fun playBillingStopsBeforeTheNetworkWhenBillingIsOff() = runBlocking {
        val session = CountingSession()
        val billing = billing(session, billingEnabled = false)

        assertTrue(billing.offers().isEmpty())
        assertFalse(billing.launch(mock(Activity::class.java), mock(PlayOffer::class.java)))
        billing.syncOwned()

        assertEquals(0, session.reads)
    }

    @Test
    fun playBillingReachesTheSessionWhenBillingIsOn() = runBlocking {
        val session = CountingSession()
        val billing = billing(session, billingEnabled = true)

        assertTrue(billing.offers().isEmpty())
        assertFalse(billing.launch(mock(Activity::class.java), mock(PlayOffer::class.java)))
        billing.syncOwned()

        assertTrue(session.reads > 0)
    }

    private fun registration(
        session: CountingSession,
        preferences: CountingPreferences,
        push: Boolean,
    ): PushRegistration {
        return PushRegistration(
            api(session),
            DataStoreRepo(preferences),
            flags(push = push),
        )
    }

    private fun billing(session: CountingSession, billingEnabled: Boolean): PlayBilling {
        return PlayBilling(
            mock(Context::class.java),
            api(session),
            mock(AccountSync::class.java),
            flags(billing = billingEnabled),
        )
    }

    private fun api(session: CountingSession) =
        ApiClient(OkHttpClient(), "http://127.0.0.1/api/v1/", session)

    private fun flags(push: Boolean = false, billing: Boolean = false) = FeatureFlags(
        voice = false,
        gallery = false,
        push = push,
        billing = billing,
        phoneSignIn = false,
    )

    private class CountingSession : SessionStore {
        var reads = 0
        override suspend fun read(): SessionTokens? {
            reads += 1
            return null
        }

        override suspend fun write(tokens: SessionTokens) = Unit

        override suspend fun clear() = Unit
    }

    private class CountingPreferences : DataStore<Preferences> {
        var writes = 0
        var reads = 0
        val state = MutableStateFlow<Preferences>(emptyPreferences())
        override val data: Flow<Preferences> = state.onStart { reads += 1 }
        override suspend fun updateData(transform: suspend (t: Preferences) -> Preferences): Preferences {
            writes += 1
            val next = transform(state.value)
            state.value = next
            return next
        }
    }
}
