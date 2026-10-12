package com.dhama.mybase

import com.dhama.mybase.core.age.AgeFollowUp
import com.dhama.mybase.core.age.ageAttestDelayMs
import com.dhama.mybase.core.age.ageAttestShouldRetry
import com.dhama.mybase.core.age.ageFollowUp
import com.dhama.mybase.core.age.agePatchJson
import com.dhama.mybase.core.age.googleAuthRequestJson
import com.dhama.mybase.core.age.localAgeGatePassed
import com.dhama.mybase.core.age.redactAge
import com.dhama.mybase.core.age.registerRequestJson
import com.dhama.mybase.core.age.withoutAgeAttributes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class AgeWireTest {

    private val dob = "1991-03-17"
    private val confirmedAt = "2026-10-12T15:04:05Z"

    @Test
    fun authBodiesNeverCarryADateOfBirth() {
        val register = registerRequestJson("a@b.co", "secret", "Ann")
        val google = googleAuthRequestJson("token")
        val patch = agePatchJson()
        assertFalse(register.contains("dateOfBirth"))
        assertFalse(register.contains("ageConfirmed"))
        assertFalse(register.contains(dob))
        assertFalse(google.contains("dateOfBirth"))
        assertFalse(google.contains(dob))
        assertEquals("""{"ageConfirmed":true}""", patch)
        assertFalse(patch.contains("dateOfBirth"))
        assertFalse(patch.contains("ageConfirmedAt"))
        assertTrue(register.contains("\"email\":\"a@b.co\""))
        assertTrue(google.contains("\"idToken\":\"token\""))
    }

    @Test
    fun followUpUsesTheAuthUserAndSkipsAProfileRead() {
        assertEquals(AgeFollowUp.None, ageFollowUp(localGatePassed = false, userPresent = true, ageConfirmedAt = null))
        assertEquals(AgeFollowUp.None, ageFollowUp(localGatePassed = true, userPresent = true, ageConfirmedAt = confirmedAt))
        assertEquals(AgeFollowUp.Patch, ageFollowUp(localGatePassed = true, userPresent = true, ageConfirmedAt = null))
        assertEquals(AgeFollowUp.Patch, ageFollowUp(localGatePassed = true, userPresent = true, ageConfirmedAt = "  "))
        assertEquals(AgeFollowUp.FetchProfile, ageFollowUp(localGatePassed = true, userPresent = false, ageConfirmedAt = null))
    }

    @Test
    fun localGateMatchesTheSignedInSubject() {
        val today = LocalDate.of(2026, 10, 12)
        val adult = LocalDate.of(1991, 3, 17)
        assertTrue(localAgeGatePassed(true, adult, "uid", "uid", today))
        assertFalse(localAgeGatePassed(true, adult, "uid", "other", today))
        assertFalse(localAgeGatePassed(true, adult, "uid", "", today))
        assertFalse(localAgeGatePassed(false, adult, "uid", "uid", today))
        assertFalse(localAgeGatePassed(true, today.minusYears(17), "uid", "uid", today))
    }

    @Test
    fun backoffGrowsThenStopsAndABadBodyDoesNotRetry() {
        assertEquals(0L, ageAttestDelayMs(0))
        assertEquals(1_000L, ageAttestDelayMs(1))
        assertEquals(16_000L, ageAttestDelayMs(5))
        assertNull(ageAttestDelayMs(6))
        assertFalse(ageAttestShouldRetry(400))
        assertFalse(ageAttestShouldRetry(401))
        assertFalse(ageAttestShouldRetry(403))
        assertTrue(ageAttestShouldRetry(429))
        assertTrue(ageAttestShouldRetry(500))
    }

    @Test
    fun okHttpLogLineDropsTheDateOfBirth() {
        val line = """
            --> POST http://10.0.2.2:3001/api/v1/auth/register
            {"email":"a@b.co","dateOfBirth":"$dob","ageConfirmedAt":"$confirmedAt"}
            dateOfBirth=$dob
        """.trimIndent()
        val redacted = redactAge(line)
        assertFalse(redacted.contains(dob))
        assertFalse(redacted.contains(confirmedAt))
        assertTrue(redacted.contains("\"dateOfBirth\":\"[redacted]\""))
        assertTrue(redacted.contains("\"ageConfirmedAt\":\"[redacted]\""))
    }

    @Test
    fun analyticsAndCrashlyticsKeysCannotCarryAge() {
        val safe = withoutAgeAttributes(
            mapOf(
                "screen" to "chat",
                "dateOfBirth" to dob,
                "dob" to dob,
                "ageConfirmedAt" to confirmedAt,
                "birth_date" to dob,
            ),
        )
        assertEquals(mapOf("screen" to "chat"), safe)
    }
}
