package com.dhama.mybase

import com.dhama.mybase.core.data.ChatRepositoryImpl
import com.dhama.mybase.core.db.dao.ChatMessageDao
import com.dhama.mybase.core.db.entity.ChatMessageEntity
import com.dhama.mybase.core.network.ApiClient
import com.dhama.mybase.core.network.IDEMPOTENCY_KEY_HEADER
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
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * An aborted stream keeps the user line and does not charge (the #17 rule).
 * Retry must finish that one line, not post it again.
 */
class DroppedReplyRetryTest {

    @Test
    fun stallAfterAcceptThenRetryChargesOnce() = runBlocking {
        val ledger = Ledger()
        val server = scriptedServer(ledger, stallAfterAccept = true)
        server.start()
        try {
            val harness = harness(server)
            val repo = harness.repo
            repo.send("hello", "Aria", "friend", emptyList(), conversationId = 7)
            val dropped = harness.dao.snapshot()
            assertTrue(dropped.any { it.delivery == "DROPPED" })

            repo.retryUnfinishedReply(7)

            val stored = harness.dao.snapshot().filter { it.kind != ChatMessageEntity.KIND_SYSTEM }
            assertEquals(1, stored.count { it.role == "USER" })
            assertEquals(1, stored.count { it.role == "ASSISTANT" && it.delivery == "SENT" })
            assertEquals("hello", stored.first { it.role == "USER" }.text)
            assertEquals("hi back", stored.first { it.role == "ASSISTANT" }.text)
            assertEquals(1, ledger.userMessages.get())
            assertEquals(1, ledger.replies.get())
            assertEquals(1, ledger.charges.get())
            assertEquals(1, ledger.streams.get())
            assertEquals(0, ledger.blockingPosts.get())
            assertEquals(1, ledger.keys.get())
        } finally {
            runCatching { server.shutdown() }
        }
    }

    @Test
    fun notSentRetryReusesTheKeyAndDoesNotDuplicate() = runBlocking {
        val ledger = Ledger()
        val server = scriptedServer(ledger, stallAfterAccept = false)
        server.start()
        try {
            val harness = harness(server)
            val repo = harness.repo
            repo.send("hello", "Aria", "friend", emptyList(), conversationId = 7)
            val before = harness.dao.snapshot()
            val user = before.first { it.role == "USER" }
            val failed = before.first { it.delivery == "FAILED" }
            assertEquals(user.id, ledger.idempotencyKey)

            repo.retryUnsent(
                text = "hello",
                name = "Aria",
                relationship = "friend",
                traits = emptyList(),
                conversationId = 7,
                clientMessageId = user.id,
                failedLocalId = failed.id,
            )

            val stored = harness.dao.snapshot().filter { it.kind != ChatMessageEntity.KIND_SYSTEM }
            assertEquals(1, stored.count { it.role == "USER" })
            assertEquals(1, stored.count { it.role == "ASSISTANT" && it.delivery == "SENT" })
            assertEquals(1, ledger.userMessages.get())
            assertEquals(1, ledger.replies.get())
            assertEquals(1, ledger.charges.get())
            assertEquals(1, ledger.streams.get())
            assertEquals(1, ledger.blockingPosts.get())
            assertEquals(1, ledger.keys.get())
            assertTrue(ledger.seenKeys.single() == user.id)
        } finally {
            runCatching { server.shutdown() }
        }
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
        val repo = ChatRepositoryImpl(dao, File("voice-notes-test"), api)
        return Harness(repo, dao)
    }
}

private class Harness(
    val repo: ChatRepositoryImpl,
    val dao: MemoryChatDao,
)

private class Ledger {
    val userMessages = AtomicInteger()
    val replies = AtomicInteger()
    val charges = AtomicInteger()
    val streams = AtomicInteger()
    val blockingPosts = AtomicInteger()
    val keys = AtomicInteger()
    val seenKeys = mutableListOf<String>()
    var idempotencyKey: String? = null
}

private fun scriptedServer(ledger: Ledger, stallAfterAccept: Boolean): MockWebServer {
    val server = MockWebServer()
    server.dispatcher = object : Dispatcher() {
        override fun dispatch(request: RecordedRequest): MockResponse {
            val path = request.path.orEmpty()
            val key = request.getHeader(IDEMPOTENCY_KEY_HEADER)
            return when {
                path.contains("/messages/stream") -> {
                    ledger.streams.incrementAndGet()
                    remember(ledger, key)
                    if (stallAfterAccept) acceptedThenQuiet() else lostAfterStore()
                }
                path.contains("/messages/reply") -> {
                    ledger.replies.incrementAndGet()
                    ledger.charges.incrementAndGet()
                    reply()
                }
                request.method == "GET" && path.contains("/messages") -> userOnly(ledger.idempotencyKey)
                request.method == "POST" && path.contains("/messages") -> {
                    ledger.blockingPosts.incrementAndGet()
                    remember(ledger, key)
                    MockResponse().setResponseCode(500).setBody("""{"message":"lost","code":"LOST"}""")
                }
                else -> MockResponse().setResponseCode(404)
            }
        }
    }
    return server
}

private fun remember(ledger: Ledger, key: String?) {
    if (key.isNullOrBlank()) return
    synchronized(ledger.seenKeys) {
        if (ledger.seenKeys.contains(key)) return
        ledger.seenKeys.add(key)
        ledger.keys.incrementAndGet()
        ledger.userMessages.incrementAndGet()
        ledger.idempotencyKey = key
    }
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

private fun lostAfterStore(): MockResponse {
    return MockResponse().setResponseCode(500).setBody("""{"message":"lost","code":"LOST"}""")
}

private fun userOnly(clientMessageId: String?): MockResponse {
    val id = clientMessageId ?: "missing"
    val body = """
        {"data":[{
          "id":1,
          "role":"USER",
          "type":"TEXT",
          "content":"hello",
          "createdAt":"2026-01-01T00:00:00.000Z",
          "metadata":{"clientMessageId":"$id"}
        }]}
    """.trimIndent()
    return MockResponse().setBody(body)
}

private fun reply(): MockResponse {
    val body = """
        {"data":{"assistantMessage":{
          "id":2,
          "role":"ASSISTANT",
          "type":"TEXT",
          "content":"hi back",
          "createdAt":"2026-01-01T00:00:01.000Z"
        }}}
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
