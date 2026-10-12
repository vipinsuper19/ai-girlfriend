package com.dhama.mybase.core.age

import java.time.Instant
import java.time.LocalDate
import java.time.Period
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

const val MINIMUM_SIGNUP_AGE = 18

object AgeGateCopy {
    const val CHECKBOX = "I am 18 or older"
    const val CONFIRM = "Confirm that you are 18 or older."
    const val ENTER_DATE = "Enter your date of birth."
    const val UNDER_AGE = "You must be 18 or older to create an account."
    const val BLOCKED = "You must be 18 or older to use this app."
    const val FUTURE = "Enter a date of birth in the past."
}

data class AgeGateDecision(
    val allowed: Boolean,
    val confirmationMessage: String?,
    val dateOfBirthMessage: String?,
)

/**
 * Completed years from [dateOfBirth] to [today].
 * A birth date later this year still reports 0; a date a full year ahead reports a negative age.
 * Future dates are rejected by [isAtLeastAge] before this count is used as a pass.
 */
fun ageYears(dateOfBirth: LocalDate, today: LocalDate): Int {
    return Period.between(dateOfBirth, today).years
}

fun isAtLeastAge(dateOfBirth: LocalDate, today: LocalDate, years: Int = MINIMUM_SIGNUP_AGE): Boolean {
    if (dateOfBirth.isAfter(today)) return false
    return ageYears(dateOfBirth, today) >= years
}

/**
 * Sign-up is allowed only when the person has checked the confirmation and the
 * date of birth is at least [MINIMUM_SIGNUP_AGE] completed years ago.
 */
fun evaluateAgeGate(
    confirmedAdult: Boolean,
    dateOfBirth: LocalDate?,
    today: LocalDate,
): AgeGateDecision {
    val dateMessage = when {
        dateOfBirth == null -> AgeGateCopy.ENTER_DATE
        dateOfBirth.isAfter(today) -> AgeGateCopy.FUTURE
        !isAtLeastAge(dateOfBirth, today) -> AgeGateCopy.UNDER_AGE
        else -> null
    }
    val confirmationMessage = if (confirmedAdult) null else AgeGateCopy.CONFIRM
    return AgeGateDecision(
        allowed = dateMessage == null && confirmationMessage == null,
        confirmationMessage = confirmationMessage,
        dateOfBirthMessage = dateMessage,
    )
}

/** Material date pickers report the selected day as UTC midnight. */
fun dateOfBirthFromUtcMillis(utcMidnightMillis: Long): LocalDate {
    return Instant.ofEpochMilli(utcMidnightMillis).atZone(ZoneOffset.UTC).toLocalDate()
}

fun utcMillisFromDateOfBirth(date: LocalDate): Long {
    return date.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
}

private val displayFormatter = DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.US)

fun formatDateOfBirth(date: LocalDate): String = displayFormatter.format(date)
