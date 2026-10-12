package com.dhama.mybase

import com.dhama.mybase.core.model.AppearanceRequest
import com.dhama.mybase.core.model.CreateAvatarRequest
import com.dhama.mybase.core.model.PersonalityRequest
import com.dhama.mybase.core.model.VoiceRequest
import com.dhama.mybase.core.network.RemoteSendFailure
import com.dhama.mybase.core.network.SessionTokens
import com.dhama.mybase.core.network.apiJson
import com.dhama.mybase.core.network.apiOrigin
import com.dhama.mybase.core.network.apiStatus
import com.dhama.mybase.core.network.rateLimitNotice
import com.dhama.mybase.core.network.remoteSendFailure
import com.dhama.mybase.core.network.sessionDisplayName
import com.dhama.mybase.core.network.unwrapData
import kotlinx.serialization.encodeToString
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

class ApiCodecTest {

    @Test
    fun originDropsTheApiPrefix() {
        assertEquals("http://10.0.2.2:3001", apiOrigin("http://10.0.2.2:3001/api/v1/"))
    }

    @Test
    fun displayNameComesFromTheEmail() {
        assertEquals("Aria", sessionDisplayName("Aria@Example.com"))
        assertEquals("Friend", sessionDisplayName("a@example.com"))
    }

    @Test
    fun unwrapsTheSuccessEnvelope() {
        val tokens = unwrapData<SessionTokens>(
            """{"success":true,"data":{"accessToken":"a","refreshToken":"r","user":{"id":1}}}""",
        )
        assertEquals("a", tokens.accessToken)
        assertEquals("r", tokens.refreshToken)
    }

    @Test
    fun keepsTheUsageLimitCode() {
        val error = apiStatus(
            403,
            """{"message":"Usage limit exceeded for MESSAGES","code":"USAGE_LIMIT_EXCEEDED"}""",
        )
        assertEquals(403, error.status)
        assertEquals("USAGE_LIMIT_EXCEEDED", error.code)
        assertEquals("Usage limit exceeded for MESSAGES", error.message)
        assertEquals(null, error.retryAfterSeconds)
    }

    @Test
    fun rateLimitKeepsRetryAfterFromTheHeader() {
        val error = apiStatus(
            429,
            """{"message":"Too many requests. Try again later.","code":"RATE_LIMITED","retryAfterSeconds":4}""",
            retryAfterHeader = "12",
        )
        assertEquals("RATE_LIMITED", error.code)
        assertEquals(12, error.retryAfterSeconds)
        assertEquals(4, apiStatus(429, """{"retryAfterSeconds":4}""").retryAfterSeconds)
        assertEquals("Too many requests. Try again in 12 seconds.", rateLimitNotice(12))
        assertEquals(RemoteSendFailure.NotLatest, remoteSendFailure(409, "NOT_LATEST_USER_MESSAGE"))
        assertEquals(RemoteSendFailure.UsageLimit, remoteSendFailure(403, "USAGE_LIMIT_EXCEEDED"))
        assertEquals(RemoteSendFailure.Missing, remoteSendFailure(404, null))
        assertEquals(RemoteSendFailure.RateLimited, remoteSendFailure(429, "RATE_LIMITED"))
    }

    @Test
    fun joinsValidationMessages() {
        val error = apiStatus(400, """{"message":["email must be an email","password should not be empty"]}""")
        assertEquals("email must be an email, password should not be empty", error.message)
        assertNull(error.code)
    }

    @Test
    fun createBodyOmitsAbsentFields() {
        val json = apiJson()
        val raw = json.encodeToString(
            CreateAvatarRequest(
                name = "Aria",
                gender = "FEMALE",
                systemPrompt = "Be kind",
                greeting = "Hi",
                appearance = AppearanceRequest(hairColor = "Brown"),
                personality = PersonalityRequest(
                    traits = listOf("Caring"),
                    humorLevel = 10,
                    flirtLevel = 10,
                    empathyLevel = 10,
                    romanceLevel = 10,
                ),
                voice = VoiceRequest(provider = "default", voiceId = "warm", language = "en"),
            ),
        )
        assertFalse(raw.contains("ethnicity"))
        assertFalse(raw.contains("null"))
        assertEquals(true, raw.contains("\"name\":\"Aria\""))
    }
}
