package com.dhama.mybase.core.age

import com.dhama.mybase.core.network.apiJson
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * Register, the Google token exchange, and PATCH users/me/age will take
 * dateOfBirth and ageConfirmedAt. Leave this false until that API is deployed:
 * register currently rejects unknown fields.
 */
const val SEND_AGE_TO_API = false

const val AGE_PATCH_PATH = "users/me/age"

@Serializable
data class RegisterRequest(
    val email: String,
    val password: String,
    val displayName: String,
    val dateOfBirth: String? = null,
    val ageConfirmedAt: String? = null,
)

@Serializable
data class GoogleAuthRequest(
    val idToken: String,
    val dateOfBirth: String? = null,
    val ageConfirmedAt: String? = null,
)

@Serializable
data class AgePatchRequest(
    val dateOfBirth: String,
    val ageConfirmedAt: String,
)

@Serializable
data class AgeWireFields(
    val dateOfBirth: String? = null,
    val ageConfirmedAt: String? = null,
)

fun ageWireFields(
    dateOfBirth: String?,
    ageConfirmedAt: String?,
    sendAgeFields: Boolean,
): AgeWireFields {
    if (!sendAgeFields) return AgeWireFields()
    if (dateOfBirth.isNullOrBlank() || ageConfirmedAt.isNullOrBlank()) return AgeWireFields()
    return AgeWireFields(dateOfBirth, ageConfirmedAt)
}

fun registerRequestJson(
    email: String,
    password: String,
    displayName: String,
    dateOfBirth: String?,
    ageConfirmedAt: String?,
    sendAgeFields: Boolean,
    json: Json = apiJson(),
): String {
    val fields = ageWireFields(dateOfBirth, ageConfirmedAt, sendAgeFields)
    return json.encodeToString(
        RegisterRequest(email, password, displayName, fields.dateOfBirth, fields.ageConfirmedAt),
    )
}

fun googleAuthRequestJson(
    idToken: String,
    dateOfBirth: String?,
    ageConfirmedAt: String?,
    sendAgeFields: Boolean,
    json: Json = apiJson(),
): String {
    val fields = ageWireFields(dateOfBirth, ageConfirmedAt, sendAgeFields)
    return json.encodeToString(GoogleAuthRequest(idToken, fields.dateOfBirth, fields.ageConfirmedAt))
}

fun agePatchJson(
    dateOfBirth: String,
    ageConfirmedAt: String,
    json: Json = apiJson(),
): String {
    return json.encodeToString(AgePatchRequest(dateOfBirth, ageConfirmedAt))
}

private val ageKey = Regex("(?i)date[_-]?of[_-]?birth|\\bdob\\b|birth[_-]?date|age[_-]?confirmed[_-]?at")

private val jsonAgeField = Regex(
    """"(dateOfBirth|date_of_birth|dob|birthDate|birth_date|ageConfirmedAt|age_confirmed_at)"\s*:\s*"(?:\\.|[^"\\])*"""",
    RegexOption.IGNORE_CASE,
)

private val labeledAgeField = Regex(
    """(?i)(dateOfBirth|date_of_birth|dob|birthDate|birth_date|ageConfirmedAt|age_confirmed_at)\s*[=:]\s*"?[\w:.+-]+""",
)

/** Scrubs age fields from a log line, including an OkHttp body log. */
fun redactAge(text: String): String {
    val jsonScrubbed = jsonAgeField.replace(text) { "\"${it.groupValues[1]}\":\"[redacted]\"" }
    return labeledAgeField.replace(jsonScrubbed) { "${it.groupValues[1]}=[redacted]" }
}

fun isAgeAttributeKey(key: String): Boolean = ageKey.containsMatchIn(key)

/** Drops keys that must not be attached to Analytics or Crashlytics. */
fun withoutAgeAttributes(attributes: Map<String, String>): Map<String, String> {
    return attributes.filterKeys { !isAgeAttributeKey(it) }
}
