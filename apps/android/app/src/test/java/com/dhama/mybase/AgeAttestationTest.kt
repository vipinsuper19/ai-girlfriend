package com.dhama.mybase

import com.dhama.mybase.core.age.ApiAgeGate
import com.dhama.mybase.core.chat.ChatStreamEvent
import com.dhama.mybase.core.data.AgeServerSync
import com.dhama.mybase.core.model.AppearanceRequest
import com.dhama.mybase.core.model.CreateAvatarRequest
import com.dhama.mybase.core.model.PersonalityRequest
import com.dhama.mybase.core.model.VoiceRequest
import com.dhama.mybase.core.network.ApiClient
import com.dhama.mybase.core.network.ApiStatusException
import com.dhama.mybase.core.network.NetworkSignals
import com.dhama.mybase.core.network.SessionStore
import com.dhama.mybase.core.network.SessionTokens
import com.dhama.mybase.core.network.coldStartOkHttp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class AgeAttestationTest {

    @Test
    fun patchSendsOnlyTheBoolean() = runBlocking {
        val server = server()
        server.enqueue(ageOk())
        try {
            val api = client(server)
            assertEquals("2026-10-12T15:04:05.000Z", api.patchAge())
            val call = server.takeRequest()
            assertEquals("PATCH", call.method)
            assertTrue(call.path.orEmpty().endsWith("/users/me/age"))
            assertEquals("""{"ageConfirmed":true}""", call.body.readUtf8())
            assertEquals(1, server.requestCount)
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun loginRegisterAndGoogleNeverSendADateOfBirth() = runBlocking {
        val server = server()
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"message":"no"}"""))
        server.enqueue(session("2026-10-12T15:04:05.000Z"))
        server.enqueue(session(null))
        server.enqueue(session("2026-10-12T15:04:05.000Z"))
        val seen = mutableListOf<Pair<Boolean, String?>>()
        try {
            val api = client(server)
            api.onAuthUser = { present, at -> seen += present to at }
            api.establish("Ada@Example.com", "secret")
            val register = server.takeRequest()
            val login = server.takeRequest()
            assertTrue(register.path.orEmpty().contains("auth/login"))
            assertTrue(login.path.orEmpty().contains("auth/register"))
            assertFalse(register.body.readUtf8().contains("dateOfBirth"))
            val registerBody = login.body.readUtf8()
            assertFalse(registerBody.contains("dateOfBirth"))
            assertFalse(registerBody.contains("ageConfirmed"))
            assertTrue(registerBody.contains("\"email\":\"ada@example.com\""))

            api.establish("ada@example.com", "secret")
            val second = server.takeRequest()
            assertTrue(second.path.orEmpty().contains("auth/login"))
            assertFalse(second.body.readUtf8().contains("dateOfBirth"))

            assertTrue(api.establishWithGoogle("firebase-token"))
            val google = server.takeRequest()
            assertTrue(google.path.orEmpty().contains("auth/google"))
            assertEquals("""{"idToken":"firebase-token"}""", google.body.readUtf8())
            assertEquals(
                listOf(true to "2026-10-12T15:04:05.000Z", true to null, true to "2026-10-12T15:04:05.000Z"),
                seen,
            )
            assertEquals(4, server.requestCount)
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun nullAgeOnLoginPatchesWithoutReadingTheProfile() = runSync { scope, idle ->
        val server = server()
        server.enqueue(session(null))
        server.enqueue(ageOk())
        val gate = FakeGate(passed = true)
        try {
            val api = client(server, gate)
            AgeServerSync(api, gate, scope = scope, wait = { fail("a null stamp patches immediately") })
            api.establish("ada@example.com", "secret")
            idle()
            val calls = taken(server)
            assertEquals(2, calls.size)
            assertTrue(calls[0].path.orEmpty().endsWith("/auth/login"))
            assertEquals("PATCH", calls[1].method)
            assertTrue(calls[1].path.orEmpty().endsWith("/users/me/age"))
            assertEquals("""{"ageConfirmed":true}""", calls[1].body.readUtf8())
            assertFalse(calls.any { it.method == "GET" })
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun confirmedAuthUserSkipsTheProfileAndThePatch() = runSync { scope, idle ->
        val server = server()
        server.enqueue(session("2026-10-12T15:04:05.000Z"))
        val gate = FakeGate(passed = true)
        try {
            val api = client(server, gate)
            val sync = AgeServerSync(api, gate, scope = scope, wait = { fail("already confirmed") })
            api.establish("ada@example.com", "secret")
            sync.onStartup()
            idle()
            val calls = taken(server)
            assertEquals(1, calls.size)
            assertTrue(calls[0].path.orEmpty().contains("auth/login"))
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun startupReadsTheProfileThenPatchesWhenUnset() = runSync { scope, idle ->
        val server = server()
        server.enqueue(MockResponse().setBody("""{"data":{"email":"a@b.co","ageConfirmedAt":null}}"""))
        server.enqueue(ageOk())
        val gate = FakeGate(passed = true)
        try {
            val api = client(server, gate)
            val sync = AgeServerSync(api, gate, scope = scope, wait = { fail("startup patches immediately") })
            sync.onStartup()
            idle()
            val calls = taken(server)
            assertEquals("GET", calls[0].method)
            assertTrue(calls[0].path.orEmpty().endsWith("/users/me"))
            assertFalse(calls[0].path.orEmpty().endsWith("/age"))
            assertEquals("PATCH", calls[1].method)
            assertEquals("""{"ageConfirmed":true}""", calls[1].body.readUtf8())
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun startupDoesNothingUntilTheLocalGatePasses() = runSync { scope, idle ->
        val server = server()
        val gate = FakeGate(passed = false)
        try {
            val api = client(server, gate)
            val sync = AgeServerSync(api, gate, scope = scope)
            sync.onStartup()
            sync.afterLocalPass()
            idle()
            assertEquals(0, server.requestCount)
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun ageRequiredOnConversationAvatarAndChatReattestsOnce() = runBlocking {
        val server = server()
        server.enqueue(ageRequired())
        server.enqueue(ageOk())
        server.enqueue(MockResponse().setBody("""{"data":{"id":9}}"""))
        server.enqueue(ageRequired())
        server.enqueue(ageOk())
        server.enqueue(MockResponse().setBody("""{"data":{"id":4}}"""))
        server.enqueue(ageRequired())
        server.enqueue(ageOk())
        server.enqueue(sse("Hi"))
        val gate = FakeGate(passed = true)
        try {
            val api = client(server, gate)
            assertEquals(9, api.createConversation(3, "Hello"))
            assertEquals(4, api.createAvatar(avatar()))
            val events = mutableListOf<ChatStreamEvent>()
            api.streamMessage(9, "Hello") { events += it }
            assertEquals(listOf(ChatStreamEvent.Done("Hi")), events)
            val calls = taken(server)
            assertEquals(9, calls.size)
            calls.filter { it.method == "PATCH" }.forEach { patch ->
                assertTrue(patch.path.orEmpty().endsWith("/users/me/age"))
                assertEquals("""{"ageConfirmed":true}""", patch.body.readUtf8())
            }
            assertEquals(3, calls.count { it.method == "PATCH" })
            assertTrue(calls.any { it.path.orEmpty().contains("/conversations") && !it.path.orEmpty().contains("stream") })
            assertTrue(calls.any { it.path.orEmpty().contains("/avatars") })
            assertTrue(calls.any { it.path.orEmpty().contains("/messages/stream") })
            assertEquals(0, gate.shown)
            assertFalse(calls.any { it.body.readUtf8().contains("dateOfBirth") })
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun ageRequiredWithoutALocalGateShowsTheGateAndDoesNotPatch() = runBlocking {
        val server = server()
        server.enqueue(ageRequired())
        val gate = FakeGate(passed = false)
        try {
            val api = client(server, gate)
            try {
                api.createConversation(3, "Hello")
                fail("expected AGE_REQUIRED")
            } catch (error: ApiStatusException) {
                assertEquals(403, error.status)
                assertEquals("AGE_REQUIRED", error.code)
            }
            assertEquals(1, gate.shown)
            assertEquals(1, server.requestCount)
            val call = server.takeRequest()
            assertFalse(call.path.orEmpty().contains("users/me/age"))
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun aSecondAgeRequiredDoesNotPatchAgain() = runBlocking {
        val server = server()
        server.enqueue(ageRequired())
        server.enqueue(ageOk())
        server.enqueue(ageRequired())
        val gate = FakeGate(passed = true)
        try {
            val api = client(server, gate)
            try {
                api.createConversation(3, "Hello")
                fail("expected the retry to fail")
            } catch (error: ApiStatusException) {
                assertEquals("AGE_REQUIRED", error.code)
            }
            val calls = taken(server)
            assertEquals(3, calls.size)
            assertEquals(1, calls.count { it.method == "PATCH" })
            assertEquals(0, gate.shown)
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun patchRetriesWithBackoffAndStopsOnABadBody() = runSync { scope, idle ->
        val server = server()
        server.enqueue(MockResponse().setResponseCode(500).setBody("""{"message":"down"}"""))
        server.enqueue(MockResponse().setResponseCode(500).setBody("""{"message":"down"}"""))
        server.enqueue(ageOk())
        val waits = mutableListOf<Long>()
        val gate = FakeGate(passed = true)
        try {
            val api = client(server, gate)
            val sync = AgeServerSync(api, gate, scope = scope, wait = { waits += it })
            sync.afterLocalPass()
            idle()
            assertEquals(listOf(1_000L, 2_000L), waits)
            assertEquals(3, server.requestCount)
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun aRejectedPatchDoesNotRetry() = runSync { scope, idle ->
        val server = server()
        server.enqueue(
            MockResponse().setResponseCode(400).setBody("""{"message":"ageConfirmed must be true"}"""),
        )
        val waits = mutableListOf<Long>()
        val gate = FakeGate(passed = true)
        try {
            val api = client(server, gate)
            val sync = AgeServerSync(api, gate, scope = scope, wait = { waits += it })
            sync.afterLocalPass()
            idle()
            assertTrue(waits.isEmpty())
            assertEquals(1, server.requestCount)
        } finally {
            server.shutdown()
        }
    }

    private fun server(): MockWebServer = MockWebServer().also { it.start() }

    private fun client(server: MockWebServer, gate: ApiAgeGate = ApiAgeGate.None): ApiClient {
        val http: OkHttpClient = coldStartOkHttp(
            NetworkSignals(hintAfterMs = 60_000),
            connectTimeoutMs = 3_000,
            readTimeoutMs = 3_000,
        )
        return ApiClient(
            http,
            server.url("/api/v1/").toString(),
            AgeSession(),
            ageGate = gate,
        )
    }
}

private class FakeGate(var passed: Boolean) : ApiAgeGate {
    var shown = 0
    override suspend fun localGatePassed(): Boolean = passed
    override fun showAgeGate() {
        shown += 1
    }
}

private class AgeSession(
    private var tokens: SessionTokens? = SessionTokens("access", "refresh"),
) : SessionStore {
    override suspend fun read(): SessionTokens? = tokens
    override suspend fun write(tokens: SessionTokens) {
        this.tokens = tokens
    }
    override suspend fun clear() {
        tokens = null
    }
}

private fun ageOk(): MockResponse {
    return MockResponse().setBody("""{"data":{"ageConfirmedAt":"2026-10-12T15:04:05.000Z"}}""")
}

private fun ageRequired(): MockResponse {
    return MockResponse()
        .setResponseCode(403)
        .setBody("""{"success":false,"statusCode":403,"message":"Confirm you are 18 or older","code":"AGE_REQUIRED"}""")
}

private fun session(ageConfirmedAt: String?): MockResponse {
    val stamp = if (ageConfirmedAt == null) "null" else "\"$ageConfirmedAt\""
    return MockResponse().setBody(
        """{"data":{"user":{"id":1,"email":"a@b.co","displayName":"Ann","ageConfirmedAt":$stamp},"accessToken":"access","refreshToken":"refresh"}}""",
    )
}

private fun sse(content: String): MockResponse {
    return MockResponse()
        .setHeader("Content-Type", "text/event-stream")
        .setBody("event: done\ndata: {\"type\":\"done\",\"message\":{\"content\":\"$content\"}}\n\n")
}

private fun avatar(): CreateAvatarRequest {
    return CreateAvatarRequest(
        name = "Aria",
        gender = "FEMALE",
        systemPrompt = "Be kind",
        greeting = "Hi",
        appearance = AppearanceRequest(hairColor = "Brown"),
        personality = PersonalityRequest(
            traits = listOf("Caring"),
            humorLevel = 1,
            flirtLevel = 1,
            empathyLevel = 1,
            romanceLevel = 1,
        ),
        voice = VoiceRequest(provider = "default", voiceId = "warm", language = "en"),
    )
}

private fun taken(server: MockWebServer): List<RecordedRequest> {
    val calls = mutableListOf<RecordedRequest>()
    repeat(server.requestCount) { calls += server.takeRequest() }
    return calls
}

private fun runSync(block: suspend (CoroutineScope, suspend () -> Unit) -> Unit) {
    runBlocking {
        val job = SupervisorJob()
        val scope = CoroutineScope(job + Dispatchers.IO)
        try {
            block(scope) { withTimeout(5_000) { awaitIdle(job) } }
        } finally {
            job.cancel()
        }
    }
}

private suspend fun awaitIdle(job: Job) {
    while (true) {
        val active = job.children.filter { it.isActive }.toList()
        if (active.isEmpty()) return
        active.forEach { it.join() }
    }
}
