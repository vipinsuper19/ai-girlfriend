package com.dhama.mybase.core.age

import com.dhama.mybase.core.network.apiJson
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

const val AGE_PATCH_PATH = "users/me/age"

/** Chat, conversation, and companion create return this until the account is attested. */
const val AGE_REQUIRED = "AGE_REQUIRED"

@Serializable
data class RegisterRequest(
    val email: String,
    val password: String,
    val displayName: String,
)

@Serializable
data class GoogleAuthRequest(
    val idToken: String,
)

/**
 * The only age body the server accepts. `false` or a missing field is 400.
 * The property has no default so it is always written, even when defaults are omitted.
 */
@Serializable
data class AgePatchRequest(val ageConfirmed: Boolean)

@Serializable
data class AgeAck(val ageConfirmedAt: String = "")

fun registerRequestJson(
    email: String,
    password: String,
    displayName: String,
    json: Json = apiJson(),
): String {
    return json.encodeToString(RegisterRequest(email, password, displayName))
}

fun googleAuthRequestJson(
    idToken: String,
    json: Json = apiJson(),
): String {
    return json.encodeToString(GoogleAuthRequest(idToken))
}

fun agePatchJson(json: Json = apiJson()): String {
    return json.encodeToString(AgePatchRequest(ageConfirmed = true))
}

private val ageKey = Regex(
    "(?i)(?<![a-z0-9])(?:" +
        "date[_-]?of[_-]?birth|" +
        "dob|" +
        "birth[_-]?date|" +
        "birthdate|" +
        "birthday|" +
        "age[_-]?confirmed(?:[_-]?(?:at|\\d+))?|" +
        "age[_-]?subject|" +
        "user[_-]?age|" +
        "age" +
        ")(?![a-z0-9])",
)

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
