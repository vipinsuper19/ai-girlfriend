package com.dhama.mybase.core.network

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.Call
import okhttp3.EventListener
import okhttp3.OkHttpClient
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/** Render Free sleeps after 15 minutes and needs about a minute to accept the first request. */
const val CONNECT_TIMEOUT_MS = 90_000L

/** Time to wait for response headers, including that cold start. */
const val FIRST_READ_TIMEOUT_MS = 90_000L

/**
 * Time with no bytes on an open SSE body. Longer than the server's 15s keepalive,
 * short enough that a dead socket does not sit there forever.
 */
const val STREAM_IDLE_TIMEOUT_MS = 45_000L

/** Show a waiting state once the first byte is this late, and keep waiting. */
const val WAKE_HINT_AFTER_MS = 5_000L

const val WAKING_SERVER = "Waking up the server…"

const val STALLED_STREAM = "The connection went quiet."

/** The SSE read went idle. The thread can offer Retry; it is not a user Stop. */
class StreamIdleException(message: String = STALLED_STREAM) : IOException(message)

/**
 * Shared client for ordinary calls. Connect and the first read both cover a cold start.
 * [NetworkSignals] flips to [WAKING_SERVER] when headers are late.
 */
fun coldStartOkHttp(
    signals: NetworkSignals,
    connectTimeoutMs: Long = CONNECT_TIMEOUT_MS,
    readTimeoutMs: Long = FIRST_READ_TIMEOUT_MS,
    writeTimeoutMs: Long = 60_000L,
): OkHttpClient {
    return OkHttpClient.Builder()
        .connectTimeout(connectTimeoutMs, TimeUnit.MILLISECONDS)
        .readTimeout(readTimeoutMs, TimeUnit.MILLISECONDS)
        .writeTimeout(writeTimeoutMs, TimeUnit.MILLISECONDS)
        .eventListenerFactory { WakeEventListener(signals) }
        .build()
}

/**
 * Streaming client. The first byte uses [firstReadTimeoutMs]. The body then tightens
 * to [STREAM_IDLE_TIMEOUT_MS] so a paused model does not inherit a limit of zero.
 */
fun streamOkHttp(
    base: OkHttpClient,
    firstReadTimeoutMs: Long = FIRST_READ_TIMEOUT_MS,
): OkHttpClient {
    return base.newBuilder()
        .readTimeout(firstReadTimeoutMs, TimeUnit.MILLISECONDS)
        .build()
}

/**
 * Tracks calls that have started and not yet received response headers.
 * One late call is enough to surface [WAKING_SERVER].
 */
class NetworkSignals(
    private val hintAfterMs: Long = WAKE_HINT_AFTER_MS,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val awaiting = ConcurrentHashMap.newKeySet<Call>()
    private var hint: Job? = null
    private val _status = MutableStateFlow<String?>(null)
    val status: StateFlow<String?> = _status.asStateFlow()

    fun onStart(call: Call) {
        synchronized(this) {
            if (!awaiting.add(call) || awaiting.size != 1) return
            hint?.cancel()
            hint = scope.launch {
                delay(hintAfterMs)
                if (awaiting.isNotEmpty()) _status.value = WAKING_SERVER
            }
        }
    }

    fun onFirstByte(call: Call) {
        synchronized(this) {
            awaiting.remove(call)
            if (awaiting.isNotEmpty()) return
            hint?.cancel()
            hint = null
            _status.value = null
        }
    }
}

private class WakeEventListener(
    private val signals: NetworkSignals,
) : EventListener() {
    override fun callStart(call: Call) = signals.onStart(call)

    override fun responseHeadersStart(call: Call) = signals.onFirstByte(call)

    override fun callEnd(call: Call) = signals.onFirstByte(call)

    override fun callFailed(call: Call, ioe: IOException) = signals.onFirstByte(call)
}
