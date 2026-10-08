package com.dhama.mybase.core.data

import com.dhama.mybase.core.network.ApiClient
import com.dhama.mybase.core.network.ApiStatusException
import com.dhama.mybase.core.utils.PreferencesKeys
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.cancellation.CancellationException

@Singleton
class PushRegistration @Inject constructor(
    private val api: ApiClient,
    private val dataStore: DataStoreRepo,
) {
    fun observeEnabled(): Flow<Boolean> =
        dataStore.getBoolean(PreferencesKeys.NOTIFICATIONS_ENABLED, false)

    /** False when there is no API session or the server has no push credentials. */
    suspend fun available(): Boolean {
        if (!api.hasSession()) return false
        return api.notificationStatus().pushConfigured
    }

    suspend fun enable() {
        if (!api.hasSession()) {
            throw ApiStatusException(401, "Sign in with email to get notifications.", null)
        }
        val token = FirebaseMessaging.getInstance().token.await()
        api.registerDevice(token)
        val saved = api.patchPrivacy(notificationsEnabled = true).notificationsEnabled
        dataStore.saveBoolean(PreferencesKeys.NOTIFICATIONS_ENABLED, saved)
    }

    suspend fun disable() {
        if (api.hasSession()) {
            api.patchPrivacy(notificationsEnabled = false)
            forgetDevice()
        }
        dataStore.saveBoolean(PreferencesKeys.NOTIFICATIONS_ENABLED, false)
    }

    suspend fun onNewToken(token: String) {
        if (!observeEnabled().first() || !api.hasSession()) return
        api.registerDevice(token)
    }

    /** Stops pushes to this phone for the signed-in account. Safe to call before signing out. */
    suspend fun forgetDevice() {
        if (!api.hasSession()) return
        try {
            val token = FirebaseMessaging.getInstance().token.await()
            api.removeDevice(token)
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            // The server drops tokens FCM reports as dead, and deleting the account removes them all.
        }
    }
}
