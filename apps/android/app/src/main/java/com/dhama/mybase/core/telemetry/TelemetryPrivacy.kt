package com.dhama.mybase.core.telemetry

import com.dhama.mybase.core.age.withoutAgeAttributes

private val emailValue = Regex(
    "[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}",
    RegexOption.IGNORE_CASE,
)

/** NANP and E.164 numbers, including separators. Short counts such as "3" do not match. */
private val phoneValue = Regex(
    """(?<!\d)(?:\+\d{1,3}[\s.-]*)?(?:\(\d{3}\)|\d{3})[\s.-]*\d{3}[\s.-]*\d{4}(?!\d)|(?<!\d)\+\d{10,15}(?!\d)|(?<!\d)\d{10,15}(?!\d)""",
)

private val labeledAge = Regex(
    "(?i)(dateOfBirth|date_of_birth|date-of-birth|dob|birthDate|birth_date|birthday|" +
        "ageConfirmedAt|age_confirmed_at|age_confirmed_18|age_subject|user_age|age)" +
        "\\s*[=:]\\s*\"?[^,\\s\"}]+",
)

private val chatTokens = setOf(
    "message",
    "messages",
    "content",
    "transcript",
    "prompt",
    "utterance",
    "reply",
    "chat",
    "text",
    "body",
)

private val secretTokens = setOf(
    "password",
    "passwd",
    "secret",
    "token",
    "authorization",
    "phone",
    "otp",
    "credential",
    "credentials",
)

private fun keyTokens(key: String): List<String> {
    return key.split(Regex("(?<=[a-z0-9])(?=[A-Z])|[_\\-.\\s]+"))
        .map { it.lowercase() }
        .filter { it.isNotEmpty() }
}

private fun isEmailKey(key: String): Boolean = keyTokens(key).any { it == "email" }

private fun isChatContentKey(key: String, value: String): Boolean {
    if (keyTokens(key).none { it in chatTokens }) return false
    return !value.all { it.isDigit() }
}

private fun isSecretKey(key: String): Boolean = keyTokens(key).any { it in secretTokens }

/**
 * Drops email, chat content, and other secrets. Age and date-of-birth keys are removed
 * first by [withoutAgeAttributes].
 */
fun stripSensitiveTelemetry(attributes: Map<String, String>): Map<String, String> {
    return attributes.mapNotNull { (key, value) ->
        val trimmedKey = key.trim()
        val trimmedValue = value.trim()
        if (trimmedKey.isEmpty()) return@mapNotNull null
        if (isEmailKey(trimmedKey) || emailValue.containsMatchIn(trimmedValue)) return@mapNotNull null
        if (phoneValue.containsMatchIn(trimmedValue)) return@mapNotNull null
        if (isChatContentKey(trimmedKey, trimmedValue)) return@mapNotNull null
        if (isSecretKey(trimmedKey)) return@mapNotNull null
        if (trimmedValue.length > 100 || trimmedValue.contains('\n') || trimmedValue.contains('\r')) {
            return@mapNotNull null
        }
        trimmedKey to trimmedValue
    }.toMap()
}

/**
 * Release collection follows consent. Debug builds stay off even when consent is granted.
 * Consent defaults to granted until an EU prompt calls [com.dhama.mybase.core.telemetry.ProductTelemetry.setCollectionConsent].
 */
fun telemetryCollectionEnabled(debugBuild: Boolean, consentGranted: Boolean): Boolean {
    return consentGranted && !debugBuild
}

/**
 * Every Analytics param map and Crashlytics attribute map passes through here before logging.
 * [withoutAgeAttributes] strips age and date-of-birth keys.
 */
fun telemetryAttributes(attributes: Map<String, String>): Map<String, String> {
    return stripSensitiveTelemetry(withoutAgeAttributes(attributes))
}

/** Scrubs email addresses and age fields from a breadcrumb or exception message. */
fun redactTelemetryText(text: String): String {
    val scrubbed = labeledAge.replace(
        phoneValue.replace(emailValue.replace(text, "[redacted]"), "[redacted]"),
    ) {
        "${it.groupValues[1]}=[redacted]"
    }
    if (scrubbed.length > 100 || scrubbed.contains('\n') || scrubbed.contains('\r')) return "[redacted]"
    return scrubbed
}
