package com.dhama.mybase.core.age

import java.time.LocalDate

/**
 * What to do when the signed-in account may still be missing an 18+ attestation.
 * A user object from register, login, or the Google exchange is enough.
 * [FetchProfile] is only for a session that did not include one, such as a cold start.
 */
enum class AgeFollowUp {
    None,
    Patch,
    FetchProfile,
}

fun ageFollowUp(
    localGatePassed: Boolean,
    userPresent: Boolean,
    ageConfirmedAt: String?,
): AgeFollowUp {
    if (!localGatePassed) return AgeFollowUp.None
    if (!userPresent) return AgeFollowUp.FetchProfile
    if (ageConfirmedAt.isNullOrBlank()) return AgeFollowUp.Patch
    return AgeFollowUp.None
}

/** Same person and an 18+ date of birth already stored on this device. */
fun localAgeGatePassed(
    confirmed: Boolean,
    dateOfBirth: LocalDate?,
    storedSubject: String,
    currentSubject: String,
    today: LocalDate,
): Boolean {
    if (currentSubject.isBlank() || storedSubject != currentSubject) return false
    return evaluateAgeGate(confirmed, dateOfBirth, today).allowed
}

/** First try is immediate. Later tries wait 1s, 2s, 4s, 8s, then 16s. */
val AGE_ATTEST_DELAYS_MS = longArrayOf(0L, 1_000L, 2_000L, 4_000L, 8_000L, 16_000L)

fun ageAttestDelayMs(attempt: Int): Long? = AGE_ATTEST_DELAYS_MS.getOrNull(attempt)

/** 400 means the body was rejected. 401 means the session is gone. Both stop. */
fun ageAttestShouldRetry(status: Int): Boolean {
    if (status == 408 || status == 429) return true
    return status in 500..599
}

/**
 * Asks the API client whether this device already passed the age gate, and
 * how to send the user there when it has not.
 */
interface ApiAgeGate {
    suspend fun localGatePassed(): Boolean

    fun showAgeGate()

    object None : ApiAgeGate {
        override suspend fun localGatePassed(): Boolean = false

        override fun showAgeGate() = Unit
    }
}
