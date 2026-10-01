package com.aicompanion.core.common

object FeatureFlags {
    const val PASSWORD_RESET = false
}

fun isValidEmail(value: String): Boolean {
    return android.util.Patterns.EMAIL_ADDRESS.matcher(value.trim()).matches()
}
