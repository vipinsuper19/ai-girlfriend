package com.dhama.mybase

import com.dhama.mybase.core.data.ChatRepositoryImpl
import com.dhama.mybase.core.db.dao.ChatMessageDao
import com.dhama.mybase.core.db.entity.ChatMessageEntity
import com.dhama.mybase.core.network.ApiClient
import com.dhama.mybase.core.network.ApiStatusException
import com.dhama.mybase.core.network.IDEMPOTENCY_KEY_HEADER
import com.dhama.mybase.core.network.isIdempotencyUuid
import com.dhama.mybase.core.network.NetworkSignals
import com.dhama.mybase.core.network.SessionStore
import com.dhama.mybase.core.network.SessionTokens
import com.dhama.mybase.core.network.coldStartOkHttp
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.File
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * An aborted stream keeps the user line and does not charge. Retry asks the
 * reply stream to finish that one line.
 */
class DroppedReplyRetryTest {

    @Test
    fun stallAfterAcceptThenRetryChargesOnce() = runBlocking {
        val ledger = Ledger()
        val server = scriptedServer(ledger, Script.StallThenReply)
        server.start()
        try {
            val harness = harness(server)
            harness.repo.send("hello", "Aria", "friend", emptyList(), conversationId = 7)
            assertTrue(harness.dao.snapshot().any { it.delivery == "DROPPED" })

            harness.repo.retryUnfinishedReply(7)

            val stored = visible(harness)
            assertEquals(1, stored.count { it.role == "USER" })
            assertEquals(1, stored.count { it.role == "ASSISTANT" && it.delivery == "SENT" })
            assertEquals("hello", stored.first { it.role == "USER" }.text)
            assertEquals("hi back", stored.first { it.role == "ASSISTANT" }.text)
            assertEquals(1, ledger.userMessages.get())
            assertEquals(1, ledger.replies.get())
            assertEquals(1, ledger.charges.get())
            assertEquals(1, ledger.streams.get())
            assertEquals(0, ledger.blockingPosts.get())
            assertEquals(1, ledger.replyCalls.get())
            assertTrue(ledger.replyPaths.single().contains("/conversations/7/messages/1/reply/stream"))
            assertEquals("{}", ledger.replyBodies.single())
            assertEquals(1, ledger.keys.size)
        } finally {
            runCatching { server.shutdown() }
        }
    }

    @Test
    fun existingReplyStreamsDoneWithoutAnotherCharge() = runBlocking {
        val ledger = Ledger()
        val server = scriptedServer(ledger, Script.ExistingReply)
        server.start()
        try {
            val harness = harness(server)
            harness.repo.retryUnfinishedReply(7)
            val stored = visible(harness)
            assertEquals(1, stored.count { it.role == "USER" })
            assertEquals(1, stored.count { it.role == "ASSISTANT" && it.delivery == "SENT" })
            assertEquals("hi back", stored.first { it.role == "ASSISTANT" }.text)
            assertEquals(0, ledger.charges.get())
            assertEquals(1, ledger.replyCalls.get())
        } finally {
            runCatching { server.shutdown() }
        }
    }

    @Test
    fun notSentRetryReusesTheKeyAndDoesNotDuplicate() = runBlocking {
        val ledger = Ledger()
        val server = scriptedServer(ledger, Script.NotSentReplay)
        server.start()
        try {
            val harness = harness(server)
            harness.repo.send("hello", "Aria", "friend", emptyList(), conversationId = 7)
            val before = harness.dao.snapshot()
            val user = before.first { it.role == "USER" }
            val failed = before.first { it.delivery == "FAILED" }
            assertEquals(user.id, ledger.keys.single())

            harness.repo.retryUnsent(
                text = "hello",
                name = "Aria",
                relationship = "friend",
                traits = emptyList(),
                conversationId = 7,
                clientMessageId = user.id,
                failedLocalId = failed.id,
            )

            val stored = visible(harness)
            assertEquals(1, stored.count { it.role == "USER" })
            assertEquals(1, stored.count { it.role == "ASSISTANT" && it.delivery == "SENT" })
            assertEquals(1, ledger.userMessages.get())
            assertEquals(1, ledger.charges.get())
            assertEquals(listOf(user.id, user.id), ledger.streamKeys)
            assertTrue(ledger.streamBodies.none { it.contains("clientMessageId") })
        } finally {
            runCatching { server.shutdown() }
        }
    }

    @Test
    fun notLatestUserMessageReloadsAndDoesNotRetry() = runBlocking {
        val ledger = Ledger()
        val server = scriptedServer(ledger, Script.NotLatest)
        server.start()
        try {
            val harness = harness(server)
            harness.repo.retryUnfinishedReply(7)
            val stored = visible(harness)
            assertEquals(1, stored.count { it.role == "USER" })
            assertEquals(1, stored.count { it.role == "ASSISTANT" })
            assertFalse(stored.any { it.delivery == "DROPPED" })
            assertEquals(1, ledger.replyCalls.get())
            assertEquals(0, ledger.charges.get())
        } finally {
            runCatching { server.shutdown() }
        }
    }

    @Test
    fun rateLimitKeepsRetryAndTheRetryAfterDelay() = runBlocking {
        val ledger = Ledger()
        val server = scriptedServer(ledger, Script.RateLimited)
        server.start()
        try {
            val harness = harness(server)
            try {
                harness.repo.retryUnfinishedReply(7)
                fail("expected the rate limit")
            } catch (error: ApiStatusException) {
                assertEquals(429, error.status)
                assertEquals("RATE_LIMITED", error.code)
                assertEquals(12, error.retryAfterSeconds)
            }
            assertTrue(harness.dao.snapshot().any { it.delivery == "DROPPED" })
            assertEquals(0, ledger.charges.get())
            assertEquals(1, ledger.replyCalls.get())
        } finally {
            runCatching { server.shutdown() }
        }
    }

    @Test
    fun usageLimitDoesNotLeaveARetry() = runBlocking {
        val ledger = Ledger()
        val server = scriptedServer(ledger, Script.UsageLimit)
        server.start()
        try {
            val harness = harness(server)
            try {
                harness.repo.retryUnfinishedReply(7)
                fail("expected the usage cap")
            } catch (error: ApiStatusException) {
                assertEquals(403, error.status)
                assertEquals("USAGE_LIMIT_EXCEEDED", error.code)
            }
            val stored = visible(harness)
            assertEquals(1, stored.count { it.role == "USER" })
            assertFalse(stored.any { it.delivery == "DROPPED" || it.role == "ASSISTANT" })
            assertEquals(0, ledger.charges.get())
        } finally {
            runCatching { server.shutdown() }
        }
    }

    @Test
    fun missingMessageReloadsWithoutARetry() = runBlocking {
        val ledger = Ledger()
        val server = scriptedServer(ledger, Script.Missing)
        server.start()
        try {
            val harness = harness(server)
            try {
                harness.repo.retryUnfinishedReply(7)
                fail("expected a missing message")
            } catch (error: ApiStatusException) {
                assertEquals(404, error.status)
            }
            assertFalse(harness.dao.snapshot().any { it.delivery == "DROPPED" })
            assertEquals(1, ledger.replyCalls.get())
        } finally {
            runCatching { server.shutdown() }
        }
    }

    @Test
    fun replayWithinADayReturnsTheOriginalWithoutAnotherCharge() = runBlocking {
        val ledger = Ledger()
        val server = scriptedServer(ledger, Script.ReplayOriginal)
        server.start()
        try {
            val harness = harness(server)
            harness.repo.send("hello", "Aria", "friend", emptyList(), conversationId = 7)
            val user = harness.dao.snapshot().first { it.role == "USER" }
            harness.repo.send(
                "hello",
                "Aria",
                "friend",
                emptyList(),
                conversationId = 7,
                clientMessageId = user.id,
            )
            val stored = visible(harness)
            assertEquals(1, stored.count { it.role == "USER" })
            assertEquals(1, stored.count { it.role == "ASSISTANT" && it.delivery == "SENT" })
            assertEquals("hi back", stored.first { it.role == "ASSISTANT" }.text)
            assertEquals(1, ledger.userMessages.get())
            assertEquals(1, ledger.charges.get())
            assertEquals(listOf(user.id, user.id), ledger.streamKeys)
            assertTrue(ledger.streamBodies.none { it.contains("clientMessageId") })
        } finally {
            runCatching { server.shutdown() }
        }
    }

    @Test
    fun replayThatIsNoLongerTheLatestLineReloadsWithoutAnotherPost() = runBlocking {
        val ledger = Ledger()
        val server = scriptedServer(ledger, Script.StaleReplay)
        server.start()
        try {
            val harness = harness(server)
            harness.repo.send("hello", "Aria", "friend", emptyList(), conversationId = 7)
            val user = harness.dao.snapshot().first { it.role == "USER" }
            harness.repo.send(
                "hello",
                "Aria",
                "friend",
                emptyList(),
                conversationId = 7,
                clientMessageId = user.id,
            )
            assertEquals(1, ledger.charges.get())
            assertEquals(0, ledger.blockingPosts.get())
            assertTrue(ledger.lists.get() >= 1)
            assertFalse(harness.dao.snapshot().any { it.delivery == "FAILED" || it.delivery == "DROPPED" })
        } finally {
            runCatching { server.shutdown() }
        }
    }

    @Test
    fun invalidIdempotencyKeyIsShownAndTheNextTryUsesANewKey() = runBlocking {
        val ledger = Ledger()
        val server = scriptedServer(ledger, Script.InvalidKey)
        server.start()
        try {
            val harness = harness(server)
            try {
                harness.repo.send("hello", "Aria", "friend", emptyList(), conversationId = 7)
                fail("expected an invalid key")
            } catch (error: ApiStatusException) {
                assertEquals(400, error.status)
                assertEquals("INVALID_IDEMPOTENCY_KEY", error.code)
                assertEquals("Idempotency-Key must be a UUID", error.message)
            }
            val sent = ledger.streamKeys.single()
            val user = harness.dao.snapshot().first { it.role == "USER" }
            val failed = harness.dao.snapshot().first { it.delivery == "FAILED" }
            assertTrue(sent != user.id)
            assertEquals(0, ledger.blockingPosts.get())
            assertEquals(0, ledger.lists.get())
            try {
                harness.repo.retryUnsent(
                    text = "hello",
                    name = "Aria",
                    relationship = "friend",
                    traits = emptyList(),
                    conversationId = 7,
                    clientMessageId = user.id,
                    failedLocalId = failed.id,
                )
                fail("expected the replacement key to be rejected too")
            } catch (error: ApiStatusException) {
                assertEquals("INVALID_IDEMPOTENCY_KEY", error.code)
            }
            assertEquals(2, ledger.streamKeys.size)
            assertTrue(ledger.streamKeys[1] != sent)
            assertEquals(0, ledger.blockingPosts.get())
        } finally {
            runCatching { server.shutdown() }
        }
    }

    @Test
    fun reusedKeyOnAnotherConversationIsNotTreatedAsNotLatest() = runBlocking {
        val ledger = Ledger()
        val server = scriptedServer(ledger, Script.KeyReused)
        server.start()
        try {
            val harness = harness(server)
            try {
                harness.repo.send("hello", "Aria", "friend", emptyList(), conversationId = 7)
                fail("expected a reused key")
            } catch (error: ApiStatusException) {
                assertEquals(409, error.status)
                assertEquals("IDEMPOTENCY_KEY_REUSED", error.code)
                assertEquals(
                    "Idempotency-Key was already used for a different conversation",
                    error.message,
                )
            }
            val user = harness.dao.snapshot().first { it.role == "USER" }
            assertTrue(ledger.streamKeys.single() != user.id)
            assertTrue(harness.dao.snapshot().any { it.delivery == "FAILED" })
            assertEquals(0, ledger.charges.get())
            assertEquals(0, ledger.lists.get())
            assertEquals(0, ledger.blockingPosts.get())
            assertEquals(0, ledger.replyCalls.get())
        } finally {
            runCatching { server.shutdown() }
        }
    }

    @Test
    fun aKeyIsNotReusedAcrossConversations() = runBlocking {
        val ledger = Ledger()
        val server = scriptedServer(ledger, Script.OtherConversation)
        server.start()
        try {
            val harness = harness(server)
            harness.repo.send("hello", "Aria", "friend", emptyList(), conversationId = 7)
            val before = harness.dao.snapshot()
            val user = before.first { it.role == "USER" }
            val failed = before.first { it.delivery == "FAILED" }
            harness.repo.retryUnsent(
                text = "hello",
                name = "Aria",
                relationship = "friend",
                traits = emptyList(),
                conversationId = 9,
                clientMessageId = user.id,
                failedLocalId = failed.id,
            )
            assertEquals(2, ledger.streamKeys.size)
            assertTrue(ledger.streamKeys[0] != ledger.streamKeys[1])
            assertTrue(isIdempotencyUuid(ledger.streamKeys[1]))
            assertTrue(ledger.streamPaths.last().contains("/conversations/9/messages/stream"))
            assertEquals(1, visible(harness).count { it.role == "USER" })
            assertEquals(1, ledger.charges.get())
        } finally {
            runCatching { server.shutdown() }
        }
    }

    @Test
    fun aNonUuidIsNeverSentAsTheIdempotencyKey() = runBlocking {
        val ledger = Ledger()
        val server = scriptedServer(ledger, Script.Accept)
        server.start()
        try {
            val harness = harness(server)
            harness.repo.send(
                "hello",
                "Aria",
                "friend",
                emptyList(),
                conversationId = 7,
                clientMessageId = "server-1",
            )
            assertEquals(1, ledger.streamKeys.size)
            assertTrue(isIdempotencyUuid(ledger.streamKeys.single()))
            assertFalse(harness.dao.snapshot().any { it.id == "server-1" })
            harness.api.streamMessage(7, "hello", "greeting") { }
            assertEquals(1, ledger.streamKeys.size)
            val upper = "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE"
            harness.api.streamMessage(7, "hello", upper) { }
            assertEquals(upper.lowercase(), ledger.streamKeys.last())
        } finally {
            runCatching { server.shutdown() }
        }
    }
}

private enum class Script {
    StallThenReply,
    ExistingReply,
    NotSentReplay,
    NotLatest,
    RateLimited,
    UsageLimit,
    Missing,
    ReplayOriginal,
    StaleReplay,
    InvalidKey,
    KeyReused,
    OtherConversation,
    Accept,
}

private class Ledger {
    val userMessages = AtomicInteger()
    val replies = AtomicInteger()
    val charges = AtomicInteger()
    val streams = AtomicInteger()
    val blockingPosts = AtomicInteger()
    val replyCalls = AtomicInteger()
    val lists = AtomicInteger()
    val keys = CopyOnWriteArrayList<String>()
    val streamKeys = CopyOnWriteArrayList<String>()
    val streamBodies = CopyOnWriteArrayList<String>()
    val replyPaths = CopyOnWriteArrayList<String>()
    val replyBodies = CopyOnWriteArrayList<String>()
    val streamPaths = CopyOnWriteArrayList<String>()
    @Volatile var boundConversation: String? = null
}

private suspend fun visible(harness: Harness): List<ChatMessageEntity> {
    return harness.dao.snapshot().filter { it.kind != ChatMessageEntity.KIND_SYSTEM }
}

private fun harness(server: MockWebServer): Harness {
    val http = coldStartOkHttp(
        NetworkSignals(hintAfterMs = 60_000),
        connectTimeoutMs = 5_000,
        readTimeoutMs = 5_000,
    )
    val api = ApiClient(
        http,
        server.url("/api/v1/").toString(),
        RetrySession(),
        streamIdleMillis = 400,
        firstReadMillis = 8_000,
    )
    val dao = MemoryChatDao()
    return Harness(ChatRepositoryImpl(dao, File("voice-notes-test"), api), dao, api)
}

private class Harness(
    val repo: ChatRepositoryImpl,
    val dao: MemoryChatDao,
    val api: ApiClient,
)

private fun scriptedServer(ledger: Ledger, script: Script): MockWebServer {
    val server = MockWebServer()
    server.dispatcher = object : Dispatcher() {
        override fun dispatch(request: RecordedRequest): MockResponse {
            val path = request.path.orEmpty()
            val key = request.getHeader(IDEMPOTENCY_KEY_HEADER)
            return when {
                path.contains("/reply/stream") -> reply(ledger, script, path, request.body.readUtf8())
                path.contains("/messages/stream") -> sendStream(ledger, script, key, request.body.readUtf8(), path)
                request.method == "GET" && path.contains("/messages") -> list(ledger, script)
                request.method == "POST" && path.contains("/messages") -> blocking(ledger, key)
                else -> MockResponse().setResponseCode(404)
            }
        }
    }
    return server
}

private fun sendStream(
    ledger: Ledger,
    script: Script,
    key: String?,
    body: String,
    path: String,
): MockResponse {
    ledger.streams.incrementAndGet()
    ledger.streamBodies.add(body)
    ledger.streamPaths.add(path)
    if (!key.isNullOrBlank()) ledger.streamKeys.add(key)
    if (script == Script.InvalidKey) return invalidKey()
    if (script == Script.KeyReused) return keyReused()
    if (script == Script.Accept) return freshReply()
    if (script == Script.OtherConversation) return otherConversation(ledger, key, path)
    if (script == Script.ReplayOriginal) return replayOriginal(ledger, key)
    if (script == Script.StaleReplay) return staleReplay(ledger, key)
    val firstTime = rememberUser(ledger, key)
    if (script == Script.StallThenReply) return acceptedThenQuiet()
    if (script == Script.NotSentReplay && ledger.streams.get() == 1) {
        return MockResponse().setResponseCode(500).setBody("""{"message":"lost","code":"LOST"}""")
    }
    if (!firstTime) {
        ledger.charges.incrementAndGet()
        ledger.replies.incrementAndGet()
    }
    return freshReply()
}

private fun replayOriginal(ledger: Ledger, key: String?): MockResponse {
    val first = rememberUser(ledger, key)
    if (!first) return originalReplay()
    ledger.charges.incrementAndGet()
    ledger.replies.incrementAndGet()
    return freshReply()
}

private fun staleReplay(ledger: Ledger, key: String?): MockResponse {
    val first = rememberUser(ledger, key)
    if (!first) {
        return jsonStatus(
            409,
            """{"statusCode":409,"message":"Only the latest user message can be retried","error":"Conflict","code":"NOT_LATEST_USER_MESSAGE"}""",
        )
    }
    ledger.charges.incrementAndGet()
    ledger.replies.incrementAndGet()
    return freshReply()
}

private fun otherConversation(ledger: Ledger, key: String?, path: String): MockResponse {
    val conversation = conversationIdOf(path)
    if (ledger.streams.get() == 1) {
        rememberUser(ledger, key)
        ledger.boundConversation = conversation
        return MockResponse().setResponseCode(500).setBody("""{"message":"lost","code":"LOST"}""")
    }
    if (!key.isNullOrBlank() && ledger.keys.contains(key) && conversation != ledger.boundConversation) {
        return keyReused()
    }
    val first = rememberUser(ledger, key)
    if (first) {
        ledger.charges.incrementAndGet()
        ledger.replies.incrementAndGet()
    }
    return freshReply()
}

private fun conversationIdOf(path: String): String {
    val marker = "/conversations/"
    val start = path.indexOf(marker)
    if (start < 0) return ""
    return path.substring(start + marker.length).substringBefore('/')
}

private fun rememberUser(ledger: Ledger, key: String?): Boolean {
    if (key.isNullOrBlank()) return false
    synchronized(ledger.keys) {
        if (ledger.keys.contains(key)) return false
        ledger.keys.add(key)
        ledger.userMessages.incrementAndGet()
        return true
    }
}

private fun blocking(ledger: Ledger, key: String?): MockResponse {
    ledger.blockingPosts.incrementAndGet()
    rememberUser(ledger, key)
    return MockResponse().setResponseCode(500).setBody("""{"message":"lost","code":"LOST"}""")
}

private fun list(ledger: Ledger, script: Script): MockResponse {
    val page = ledger.lists.incrementAndGet()
    val withReply = script == Script.NotLatest && page >= 2
    return if (withReply) userAndAssistant() else userOnly()
}

private fun reply(ledger: Ledger, script: Script, path: String, body: String): MockResponse {
    ledger.replyCalls.incrementAndGet()
    ledger.replyPaths.add(path)
    ledger.replyBodies.add(body)
    return when (script) {
        Script.NotLatest -> jsonStatus(
            409,
            """{"statusCode":409,"message":"Only the latest user message can be retried","error":"Conflict","code":"NOT_LATEST_USER_MESSAGE"}""",
        )
        Script.RateLimited -> jsonStatus(
            429,
            """{"message":"Too many requests. Try again later.","code":"RATE_LIMITED","retryAfterSeconds":12}""",
        ).setHeader("Retry-After", "12")
        Script.UsageLimit -> jsonStatus(
            403,
            """{"message":"Usage limit exceeded for MESSAGES","code":"USAGE_LIMIT_EXCEEDED"}""",
        )
        Script.Missing -> jsonStatus(404, """{"message":"Message not found"}""")
        Script.ExistingReply -> doneOnly()
        else -> {
            ledger.charges.incrementAndGet()
            ledger.replies.incrementAndGet()
            freshReply()
        }
    }
}

private fun jsonStatus(code: Int, body: String): MockResponse {
    return MockResponse().setResponseCode(code).setBody(body)
}

private fun acceptedThenQuiet(): MockResponse {
    val event = "event: message\ndata: {\"type\":\"message\",\"message\":{\"content\":\"hello\"}}\n\n"
    val body = event + ": ping\n\n".repeat(40)
    return MockResponse()
        .setResponseCode(200)
        .addHeader("Content-Type", "text/event-stream")
        .setBody(body)
        .throttleBody(event.length.toLong(), 5, TimeUnit.SECONDS)
}

private fun invalidKey(): MockResponse {
    return jsonStatus(
        400,
        """{"statusCode":400,"message":"Idempotency-Key must be a UUID","error":"Bad Request","code":"INVALID_IDEMPOTENCY_KEY"}""",
    )
}

private fun keyReused(): MockResponse {
    return jsonStatus(
        409,
        """{"statusCode":409,"message":"Idempotency-Key was already used for a different conversation","error":"Conflict","code":"IDEMPOTENCY_KEY_REUSED"}""",
    )
}

private fun originalReplay(): MockResponse {
    val body = "event: message\ndata: {\"type\":\"message\",\"message\":{\"id\":1,\"role\":\"USER\",\"content\":\"hello\"}}\n\n" +
        "event: done\ndata: {\"type\":\"done\",\"message\":{\"id\":2,\"role\":\"ASSISTANT\",\"content\":\"hi back\"}}\n\n"
    return MockResponse()
        .setResponseCode(200)
        .addHeader("Content-Type", "text/event-stream")
        .setBody(body)
}

private fun freshReply(): MockResponse {
    val body = "event: delta\ndata: {\"type\":\"delta\",\"content\":\"hi \"}\n\n" +
        "event: done\ndata: {\"type\":\"done\",\"message\":{\"id\":2,\"role\":\"ASSISTANT\",\"content\":\"hi back\"}}\n\n"
    return MockResponse()
        .setResponseCode(200)
        .addHeader("Content-Type", "text/event-stream")
        .setBody(body)
}

private fun doneOnly(): MockResponse {
    val body = "event: done\ndata: {\"type\":\"done\",\"message\":{\"id\":2,\"role\":\"ASSISTANT\",\"content\":\"hi back\"},\"safety\":{\"code\":\"content_policy\"}}\n\n"
    return MockResponse()
        .setResponseCode(200)
        .addHeader("Content-Type", "text/event-stream")
        .setBody(body)
}

private fun userOnly(): MockResponse {
    val body = """
        {"data":[{
          "id":1,
          "role":"USER",
          "type":"TEXT",
          "content":"hello",
          "createdAt":"2026-01-01T00:00:00.000Z"
        }]}
    """.trimIndent()
    return MockResponse().setBody(body)
}

private fun userAndAssistant(): MockResponse {
    val body = """
        {"data":[
          {"id":1,"role":"USER","type":"TEXT","content":"hello","createdAt":"2026-01-01T00:00:00.000Z"},
          {"id":2,"role":"ASSISTANT","type":"TEXT","content":"already here","createdAt":"2026-01-01T00:00:01.000Z"}
        ]}
    """.trimIndent()
    return MockResponse().setBody(body)
}

private class MemoryChatDao : ChatMessageDao {
    private val rows = linkedMapOf<String, ChatMessageEntity>()
    private val flow = MutableStateFlow<List<ChatMessageEntity>>(emptyList())

    override fun observe(): Flow<List<ChatMessageEntity>> = flow

    override suspend fun snapshot(): List<ChatMessageEntity> = rows.values.toList()

    override suspend fun upsert(message: ChatMessageEntity) {
        rows[message.id] = message
        publish()
    }

    override suspend fun find(id: String): ChatMessageEntity? = rows[id]

    override suspend fun delete(id: String) {
        rows.remove(id)
        publish()
    }

    override suspend fun clear() {
        rows.clear()
        publish()
    }

    override suspend fun count(): Int = rows.size

    private fun publish() {
        flow.value = rows.values.sortedBy { it.createdAtEpochMs }
    }
}

private class RetrySession(
    private val tokens: SessionTokens = SessionTokens("access", "refresh"),
) : SessionStore {
    override suspend fun read(): SessionTokens = tokens
    override suspend fun write(tokens: SessionTokens) = Unit
    override suspend fun clear() = Unit
}
