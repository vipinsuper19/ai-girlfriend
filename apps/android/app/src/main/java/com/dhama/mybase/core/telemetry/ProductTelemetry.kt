package com.dhama.mybase.core.telemetry

import android.content.Context
import android.os.Bundle
import com.dhama.mybase.BuildConfig
import com.dhama.mybase.core.age.withoutAgeAttributes
import com.google.firebase.FirebaseApp
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.crashlytics.FirebaseCrashlytics

/**
 * Analytics and Crashlytics entry points. Collection is off in debug and on in release.
 * Each map is passed through [withoutAgeAttributes] before anything is logged.
 */
object ProductTelemetry {
    private var appContext: Context? = null

    @Volatile
    private var collecting: Boolean = false

    /** Defaults to granted. An EU consent screen calls this with the user's choice. */
    @Volatile
    private var consentGranted: Boolean = true

    fun start(context: Context) {
        appContext = context.applicationContext
        pushCollection()
        if (collecting) {
            logEvent("app_start")
            setCrashlyticsAttributes(mapOf("build_type" to "release"))
        }
    }

    /**
     * Turns Analytics and Crashlytics collection on or off together.
     * Debug builds stay off. Release collection follows this flag, which defaults to on.
     */
    fun setCollectionConsent(granted: Boolean) {
        consentGranted = granted
        pushCollection()
    }

    private fun pushCollection() {
        val context = appContext ?: return
        val firebaseReady = FirebaseApp.getApps(context).isNotEmpty()
        val collect = firebaseReady && telemetryCollectionEnabled(BuildConfig.DEBUG, consentGranted)
        if (firebaseReady) {
            FirebaseCrashlytics.getInstance().isCrashlyticsCollectionEnabled = collect
            FirebaseAnalytics.getInstance(context).setAnalyticsCollectionEnabled(collect)
        }
        collecting = collect
    }

    fun logEvent(name: String, params: Map<String, String> = emptyMap()) {
        val safe = telemetryAttributes(withoutAgeAttributes(params))
        if (!collecting) return
        analyticsOrNull()?.logEvent(eventName(name), safe.toBundle())
    }

    fun setCrashlyticsAttributes(attributes: Map<String, String>) {
        val safe = telemetryAttributes(withoutAgeAttributes(attributes))
        if (!collecting) return
        val crashlytics = crashlyticsOrNull() ?: return
        safe.forEach { (key, value) -> crashlytics.setCustomKey(paramName(key), value) }
    }

    fun recordNonFatal(error: Throwable, attributes: Map<String, String> = emptyMap()) {
        val safe = telemetryAttributes(withoutAgeAttributes(attributes))
        if (!collecting) return
        val crashlytics = crashlyticsOrNull() ?: return
        safe.forEach { (key, value) -> crashlytics.setCustomKey(paramName(key), value) }
        crashlytics.recordException(redactedNonFatal(error))
    }

    private fun analyticsOrNull(): FirebaseAnalytics? {
        val context = appContext ?: return null
        if (FirebaseApp.getApps(context).isEmpty()) return null
        return FirebaseAnalytics.getInstance(context)
    }

    private fun crashlyticsOrNull(): FirebaseCrashlytics? {
        val context = appContext ?: return null
        if (FirebaseApp.getApps(context).isEmpty()) return null
        return FirebaseCrashlytics.getInstance()
    }

    private fun Map<String, String>.toBundle(): Bundle {
        val bundle = Bundle(size)
        for ((key, value) in this) {
            bundle.putString(paramName(key), value)
        }
        return bundle
    }
}

private fun eventName(name: String): String {
    val cleaned = name.lowercase().replace(Regex("[^a-z0-9_]"), "_").trim('_')
    val named = if (cleaned.firstOrNull()?.isLetter() == true) cleaned else "e_$cleaned"
    return named.take(40).ifBlank { "app_event" }
}

private fun paramName(name: String): String {
    val cleaned = name.replace(Regex("[^A-Za-z0-9_]"), "_")
    val named = if (cleaned.firstOrNull()?.isLetter() == true) cleaned else "p_$cleaned"
    return named.take(40).ifBlank { "param" }
}

private fun redactedNonFatal(error: Throwable): Throwable {
    val message = redactTelemetryText(error.message.orEmpty()).ifBlank { error.javaClass.simpleName }
    return RedactedNonFatal(message, error.stackTrace)
}

private class RedactedNonFatal(
    message: String,
    originalStack: Array<StackTraceElement>,
) : Exception(message) {
    init {
        stackTrace = originalStack
    }
}
