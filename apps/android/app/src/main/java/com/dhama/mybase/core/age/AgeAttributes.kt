package com.dhama.mybase.core.age

/**
 * Age and date-of-birth keys that must not be attached to Analytics or Crashlytics.
 * Equivalent to the age-gate helper of the same name: drop the key, keep the rest of the map.
 */
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

fun isAgeAttributeKey(key: String): Boolean = ageKey.containsMatchIn(key)

/** Drops keys that must not be attached to Analytics or Crashlytics. */
fun withoutAgeAttributes(attributes: Map<String, String>): Map<String, String> {
    return attributes.filterKeys { !isAgeAttributeKey(it) }
}
