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
import com.dhama.mybase.core.network.dataElement
import com.dhama.mybase.core.network.idempotencyKeyFor
import com.dhama.mybase.core.network.idempotencyKeyOrNull
import com.dhama.mybase.core.network.rateLimitNotice
import com.dhama.mybase.core.network.remoteSendFailure
import com.dhama.mybase.core.network.scrubCancellation
import com.dhama.mybase.core.network.scrubTransportFailure
import com.dhama.mybase.core.network.sessionDisplayName
import com.dhama.mybase.core.network.unwrapData
import kotlinx.serialization.encodeToString
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.CancellationException

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
        assertEquals(RemoteSendFailure.KeyReused, remoteSendFailure(409, "IDEMPOTENCY_KEY_REUSED"))
        assertEquals(RemoteSendFailure.InvalidKey, remoteSendFailure(400, "INVALID_IDEMPOTENCY_KEY"))
        assertEquals(RemoteSendFailure.Other, remoteSendFailure(409, null))
        assertEquals(RemoteSendFailure.UsageLimit, remoteSendFailure(403, "USAGE_LIMIT_EXCEEDED"))
        assertEquals(RemoteSendFailure.Missing, remoteSendFailure(404, null))
        assertEquals(RemoteSendFailure.RateLimited, remoteSendFailure(429, "RATE_LIMITED"))
        val key = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
        assertEquals(null, idempotencyKeyOrNull("server-1"))
        assertEquals(null, idempotencyKeyOrNull("greeting"))
        assertEquals(key, idempotencyKeyOrNull(key.uppercase()))
        assertEquals(key, idempotencyKeyFor(key, conversationId = 7, boundConversationId = 7))
        assertEquals(key, idempotencyKeyFor(key, conversationId = 7, boundConversationId = null))
        assertEquals(null, idempotencyKeyFor(key, conversationId = 8, boundConversationId = 7))
        assertEquals(null, idempotencyKeyFor("server-1", conversationId = 7, boundConversationId = null))
    }

    @Test
    fun statusExceptionDropsBodiesPromptsAndHasNoCause() {
        val secret = "I miss you tonight"
        val echoed = apiStatus(
            400,
            """{"message":"$secret","content":"$secret","prompt":"be warm","code":"CHAT"}""",
        )
        assertEquals("Request failed", echoed.message)
        assertEquals("CHAT", echoed.code)
        assertNull(echoed.cause)
        assertFalse(echoed.toString().contains(secret))
        assertTrue(echoed.suppressed.isEmpty())

        val body = apiStatus(
            500,
            """{"message":"{\"content\":\"$secret\",\"prompt\":\"be warm\"}"}""",
        )
        assertEquals("Request failed", body.message)
        assertNull(body.cause)
        assertFalse(body.toString().contains(secret))

        val contact = apiStatus(400, """{"message":"reach ada@example.com or +1 415 555 2671"}""")
        assertEquals("Request failed", contact.message)
        assertNull(contact.cause)
        assertFalse(contact.toString().contains("ada@"))
        assertFalse(contact.toString().contains("415"))
    }

    @Test
    fun decodeFailureDoesNotKeepTheResponseBody() {
        val secret = "I miss you tonight"
        val error = runCatching {
            unwrapData<SessionTokens>("""{"success":true,"data":{"content":"$secret","prompt":"be warm"}}""")
        }.exceptionOrNull()
        assertNotNull(error)
        assertEquals("Request failed", error!!.message)
        assertNull(error.cause)
        assertTrue(error.suppressed.isEmpty())
        assertFalse(error.toString().contains(secret))
        assertFalse(error.toString().contains("be warm"))

        val broken = runCatching { dataElement("""{"content":"$secret","prompt":"be warm"""") }.exceptionOrNull()
        assertNotNull(broken)
        assertEquals("Request failed", broken!!.message)
        assertNull(broken.cause)
        assertFalse(broken.toString().contains(secret))
    }

    @Test
    fun transportAndCancellationDropCausesThatHoldABody() {
        val secret = """{"content":"I miss you","prompt":"system"}"""
        val transport = scrubTransportFailure(
            IllegalStateException("socket closed", IllegalStateException(secret)),
        )
        assertEquals("socket closed", transport.message)
        assertNull(transport.cause)
        assertFalse(transport.toString().contains("I miss you"))

        val leaked = scrubTransportFailure(IllegalStateException(secret))
        assertEquals("Request failed", leaked.message)
        assertNull(leaked.cause)
        assertFalse(leaked.toString().contains("prompt"))

        val cancelled = CancellationException("Stopped").apply {
            initCause(IllegalStateException(secret))
        }
        val scrubbed = scrubCancellation(cancelled)
        assertEquals("Stopped", scrubbed.message)
        assertNull(scrubbed.cause)
        assertFalse(scrubbed.toString().contains("I miss you"))
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
