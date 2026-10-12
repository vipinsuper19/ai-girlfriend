package com.dhama.mybase.core

import com.dhama.mybase.BuildConfig

/**
 * Compile-time switches for the first release. [build] is what the APK was
 * compiled with. Tests and Hilt can supply another instance so both states
 * are reachable without a second build.
 */
data class FeatureFlags(
    val voice: Boolean,
    val gallery: Boolean,
    val push: Boolean,
    val billing: Boolean,
    val phoneSignIn: Boolean,
) {
    companion object {
        val build: FeatureFlags = FeatureFlags(
            voice = BuildConfig.FEATURE_VOICE,
            gallery = BuildConfig.FEATURE_GALLERY,
            push = BuildConfig.FEATURE_PUSH,
            billing = BuildConfig.FEATURE_BILLING,
            phoneSignIn = BuildConfig.FEATURE_PHONE_SIGN_IN,
        )
    }
}
