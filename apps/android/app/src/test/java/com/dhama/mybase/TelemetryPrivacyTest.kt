package com.dhama.mybase

import com.dhama.mybase.core.telemetry.redactTelemetryText
import com.dhama.mybase.core.telemetry.telemetryAttributes
import com.dhama.mybase.core.telemetry.telemetryCollectionEnabled
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TelemetryPrivacyTest {

    @Test
    fun analyticsAndCrashlyticsMapsDropAgeEmailAndChat() {
        val safe = telemetryAttributes(
            mapOf(
                "screen" to "chat",
                "plan" to "free",
                "dateOfBirth" to "1991-03-17",
                "dob" to "1991-03-17",
                "ageConfirmedAt" to "2026-10-12T15:04:05Z",
                "birth_date" to "1991-03-17",
                "age" to "34",
                "email" to "ada@example.com",
                "user_email" to "ada@example.com",
                "detail" to "reach ada@example.com",
                "message" to "I miss you",
                "content" to "hello",
                "chat" to "what we said",
                "text" to "a reply",
                "message_count" to "3",
                "password" to "secret",
                "phone" to "5551212",
            ),
        )
        assertEquals(mapOf("screen" to "chat", "plan" to "free", "message_count" to "3"), safe)
        assertFalse(safe.values.any { it.contains("1991-03-17") })
        assertFalse(safe.values.any { it.contains("@") })
        assertFalse(safe.values.any { it.contains("I miss you") })
    }

    @Test
    fun phoneNumbersAreDroppedByValue() {
        val safe = telemetryAttributes(
            mapOf(
                "screen" to "settings",
                "note" to "+1 (415) 555-2671",
                "detail" to "415-555-1212",
                "ref" to "+14155552671",
                "stamp" to "1991-03-17",
                "message_count" to "3",
            ),
        )
        assertEquals(
            mapOf(
                "screen" to "settings",
                "stamp" to "1991-03-17",
                "message_count" to "3",
            ),
            safe,
        )
    }

    @Test
    fun collectionFollowsConsentAndStaysOffInDebug() {
        assertFalse(telemetryCollectionEnabled(debugBuild = true, consentGranted = true))
        assertTrue(telemetryCollectionEnabled(debugBuild = false, consentGranted = true))
        assertFalse(telemetryCollectionEnabled(debugBuild = false, consentGranted = false))
    }

    @Test
    fun breadcrumbsDoNotKeepEmailOrDateOfBirth() {
        val line = redactTelemetryText("email=ada@example.com dateOfBirth=1991-03-17 screen=home")
        assertFalse(line.contains("ada@example.com"))
        assertFalse(line.contains("1991-03-17"))
        assertEquals(true, line.contains("screen=home"))
        val phone = redactTelemetryText("call 415-555-1212 later")
        assertFalse(phone.contains("415"))
        assertFalse(phone.contains("555"))
    }

    @Test
    fun longChatTextIsNotTruncatedIntoAReport() {
        val chat = "hello ".repeat(40)
        assertEquals("[redacted]", redactTelemetryText(chat))
        assertEquals(emptyMap<String, String>(), telemetryAttributes(mapOf("note" to chat)))
    }
}
