package com.dhama.mybase.core

import com.dhama.mybase.BuildConfig

/**
 * Compile-time switches for the first release. Each value comes from a
 * `buildConfigField` in `app/build.gradle.kts`. Flip that field to `true` and
 * rebuild to bring the feature back; the screens and calls stay in the tree.
 */
object FeatureFlags {
    val voice: Boolean = BuildConfig.FEATURE_VOICE
    val gallery: Boolean = BuildConfig.FEATURE_GALLERY
    val push: Boolean = BuildConfig.FEATURE_PUSH
    val billing: Boolean = BuildConfig.FEATURE_BILLING
    val phoneSignIn: Boolean = BuildConfig.FEATURE_PHONE_SIGN_IN
}
