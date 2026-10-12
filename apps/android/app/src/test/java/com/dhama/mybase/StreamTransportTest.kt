package com.dhama.mybase

import com.dhama.mybase.core.chat.ChatStreamEvent
import com.dhama.mybase.core.chat.idleStallDelivery
import com.dhama.mybase.core.chat.retryCaption
import com.dhama.mybase.core.network.ApiClient
import com.dhama.mybase.core.network.CONNECT_TIMEOUT_MS
import com.dhama.mybase.core.network.FIRST_READ_TIMEOUT_MS
import com.dhama.mybase.core.network.NetworkSignals
import com.dhama.mybase.core.network.STALLED_STREAM
import com.dhama.mybase.core.network.STREAM_IDLE_TIMEOUT_MS
import com.dhama.mybase.core.network.SessionStore
import com.dhama.mybase.core.network.SessionTokens
import com.dhama.mybase.core.network.StreamIdleException
import com.dhama.mybase.core.network.WAKE_HINT_AFTER_MS
import com.dhama.mybase.core.network.WAKING_SERVER
import com.dhama.mybase.core.network.coldStartOkHttp
import com.dhama.mybase.core.network.streamOkHttp
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.net.InetAddress
import java.net.Socket
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit
import javax.net.SocketFactory

class StreamTransportTest {

    @Test
    fun coldStartTimeoutsCoverTheFreeTier() {
        assertTrue(CONNECT_TIMEOUT_MS in 60_000L..90_000L)
        assertTrue(FIRST_READ_TIMEOUT_MS in 60_000L..90_000L)
        assertTrue(STREAM_IDLE_TIMEOUT_MS in 30_000L..60_000L)
        assertEquals(5_000L, WAKE_HINT_AFTER_MS)
        val http = coldStartOkHttp(NetworkSignals())
        assertEquals(CONNECT_TIMEOUT_MS, http.connectTimeoutMillis.toLong())
        assertEquals(FIRST_READ_TIMEOUT_MS, http.readTimeoutMillis.toLong())
        val stream = streamOkHttp(http)
        assertEquals(CONNECT_TIMEOUT_MS, stream.connectTimeoutMillis.toLong())
        assertEquals(FIRST_READ_TIMEOUT_MS, stream.readTimeoutMillis.toLong())
        assertNotEquals(0, stream.readTimeoutMillis)
    }

    @Test
    fun idleTimeoutFailsInsteadOfHanging() = runBlocking {
        val server = MockWebServer()
        server.enqueue(
            MockResponse()
                .setHeader("Content-Type", "text/event-stream")
                .setBodyDelay(3, TimeUnit.SECONDS)
                .setBody("event: delta\ndata: {\"type\":\"delta\",\"content\":\"Hi\"}\n\n"),
        )
        server.start()
        try {
            val api = api(server, streamIdleMillis = 400, firstReadMillis = 8_000)
            val started = System.nanoTime()
            try {
                api.streamMessage(7, "hello") { }
                fail("expected the idle timeout")
            } catch (error: StreamIdleException) {
                val elapsedMs = (System.nanoTime() - started) / 1_000_000
                assertTrue("idle took ${elapsedMs}ms", elapsedMs < 2_000)
                assertEquals(STALLED_STREAM, error.message)
            }
            assertEquals("Not sent · Retry", retryCaption(idleStallDelivery(userAccepted = false, replyStarted = false)))
            assertEquals(
                "Reply didn't finish · Retry",
                retryCaption(idleStallDelivery(userAccepted = true, replyStarted = true)),
            )
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun stopClosesTheSocketTheServerIsWriting() = runBlocking {
        val server = MockWebServer()
        val sockets = RecordingSocketFactory()
        server.enqueue(
            MockResponse()
                .setHeader("Content-Type", "text/event-stream")
                .setBodyDelay(30, TimeUnit.SECONDS)
                .setBody("event: delta\ndata: {\"type\":\"delta\",\"content\":\"Hi\"}\n\n"),
        )
        server.start()
        val job = launch(Dispatchers.IO) {
            api(server, sockets = sockets, streamIdleMillis = 30_000, firstReadMillis = 8_000)
                .streamMessage(7, "hello") { }
        }
        try {
            val recorded = server.takeRequest(4, TimeUnit.SECONDS)
            assertNotNull(recorded)
            val stoppedAt = System.nanoTime()
            withTimeout(3_000) { job.cancelAndJoin() }
            val elapsedMs = (System.nanoTime() - stoppedAt) / 1_000_000
            assertTrue("stop hung for ${elapsedMs}ms", elapsedMs < 2_000)
            assertTrue(
                "the HTTP socket stayed open",
                sockets.created.any { it.isClosed || it.isInputShutdown || it.isOutputShutdown },
            )
        } finally {
            job.cancel()
            runCatching { server.shutdown() }
        }
    }

    @Test
    fun slowFirstByteWakesTheRegularClientInsteadOfFailing() = runBlocking {
        val server = MockWebServer()
        server.enqueue(
            MockResponse()
                .setHeadersDelay(1, TimeUnit.SECONDS)
                .setBody("""{"success":true,"data":[]}"""),
        )
        server.start()
        try {
            val signals = NetworkSignals(hintAfterMs = 200)
            val api = api(server, signals = signals, connectTimeoutMs = 5_000, readTimeoutMs = 5_000)
            val woke = async { withTimeout(4_000) { signals.status.first { it == WAKING_SERVER } } }
            val avatars = api.listAvatars()
            assertEquals(WAKING_SERVER, woke.await())
            assertTrue(avatars.isEmpty())
            withTimeout(2_000) { signals.status.first { it == null } }
            Unit
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun slowStreamHeadersWakeThenDeliver() = runBlocking {
        val server = MockWebServer()
        server.enqueue(
            MockResponse()
                .setHeadersDelay(1, TimeUnit.SECONDS)
                .setHeader("Content-Type", "text/event-stream")
                .setBody("event: done\ndata: {\"type\":\"done\",\"message\":{\"content\":\"Hi\"}}\n\n"),
        )
        server.start()
        try {
            val signals = NetworkSignals(hintAfterMs = 200)
            val api = api(
                server,
                signals = signals,
                connectTimeoutMs = 5_000,
                readTimeoutMs = 5_000,
                streamIdleMillis = 5_000,
                firstReadMillis = 5_000,
            )
            val woke = async { withTimeout(4_000) { signals.status.first { it == WAKING_SERVER } } }
            val events = CompletableDeferred<List<ChatStreamEvent>>()
            val seen = mutableListOf<ChatStreamEvent>()
            api.streamMessage(7, "hello") { event ->
                seen += event
                if (event is ChatStreamEvent.Done) events.complete(seen.toList())
            }
            assertEquals(WAKING_SERVER, woke.await())
            assertEquals(listOf(ChatStreamEvent.Done("Hi")), events.await())
        } finally {
            server.shutdown()
        }
    }

    private fun api(
        server: MockWebServer,
        signals: NetworkSignals = NetworkSignals(hintAfterMs = 60_000),
        sockets: SocketFactory? = null,
        connectTimeoutMs: Long = 5_000,
        readTimeoutMs: Long = 5_000,
        streamIdleMillis: Long = 45_000,
        firstReadMillis: Long = 5_000,
    ): ApiClient {
        var http: OkHttpClient = coldStartOkHttp(signals, connectTimeoutMs, readTimeoutMs)
        if (sockets != null) http = http.newBuilder().socketFactory(sockets).build()
        return ApiClient(
            http,
            server.url("/api/v1/").toString(),
            MemorySession(),
            streamIdleMillis = streamIdleMillis,
            firstReadMillis = firstReadMillis,
        )
    }
}

private class MemorySession(
    private val tokens: SessionTokens = SessionTokens("access", "refresh"),
) : SessionStore {
    override suspend fun read(): SessionTokens = tokens
    override suspend fun write(tokens: SessionTokens) = Unit
    override suspend fun clear() = Unit
}

private class RecordingSocketFactory : SocketFactory() {
    val created = CopyOnWriteArrayList<Socket>()

    override fun createSocket(): Socket = Socket().also(created::add)

    override fun createSocket(host: String?, port: Int): Socket = Socket(host, port).also(created::add)

    override fun createSocket(host: String?, port: Int, localHost: InetAddress?, localPort: Int): Socket {
        return Socket(host, port, localHost, localPort).also(created::add)
    }

    override fun createSocket(address: InetAddress?, port: Int): Socket = Socket(address, port).also(created::add)

    override fun createSocket(
        address: InetAddress?,
        port: Int,
        localAddress: InetAddress?,
        localPort: Int,
    ): Socket = Socket(address, port, localAddress, localPort).also(created::add)
}
