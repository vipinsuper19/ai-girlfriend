package com.dhama.mybase

import com.dhama.mybase.core.age.SEND_AGE_TO_API
import com.dhama.mybase.core.age.agePatchJson
import com.dhama.mybase.core.age.googleAuthRequestJson
import com.dhama.mybase.core.age.redactAge
import com.dhama.mybase.core.age.registerRequestJson
import com.dhama.mybase.core.age.withoutAgeAttributes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AgeWireTest {

    private val dob = "1991-03-17"
    private val confirmedAt = "2026-10-12T15:04:05Z"

    @Test
    fun ageFieldsStayOffTheWireUntilTheBackendAcceptsThem() {
        assertFalse(SEND_AGE_TO_API)
        val register = registerRequestJson(
            email = "a@b.co",
            password = "secret",
            displayName = "Ann",
            dateOfBirth = dob,
            ageConfirmedAt = confirmedAt,
            sendAgeFields = SEND_AGE_TO_API,
        )
        val google = googleAuthRequestJson(
            idToken = "token",
            dateOfBirth = dob,
            ageConfirmedAt = confirmedAt,
            sendAgeFields = SEND_AGE_TO_API,
        )
        assertFalse(register.contains("dateOfBirth"))
        assertFalse(register.contains("ageConfirmedAt"))
        assertFalse(register.contains(dob))
        assertFalse(register.contains(confirmedAt))
        assertFalse(google.contains("dateOfBirth"))
        assertFalse(google.contains(dob))
        assertTrue(register.contains("\"email\":\"a@b.co\""))
        assertTrue(google.contains("\"idToken\":\"token\""))
    }

    @Test
    fun preparedPayloadsIncludeAgeOnceTheSwitchIsOn() {
        val register = registerRequestJson(
            email = "a@b.co",
            password = "secret",
            displayName = "Ann",
            dateOfBirth = dob,
            ageConfirmedAt = confirmedAt,
            sendAgeFields = true,
        )
        val google = googleAuthRequestJson("token", dob, confirmedAt, sendAgeFields = true)
        val patch = agePatchJson(dob, confirmedAt)
        assertTrue(register.contains("\"dateOfBirth\":\"$dob\""))
        assertTrue(register.contains("\"ageConfirmedAt\":\"$confirmedAt\""))
        assertTrue(google.contains("\"dateOfBirth\":\"$dob\""))
        assertTrue(google.contains("\"ageConfirmedAt\":\"$confirmedAt\""))
        assertTrue(patch.contains("\"dateOfBirth\":\"$dob\""))
        assertTrue(patch.contains("\"ageConfirmedAt\":\"$confirmedAt\""))
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
