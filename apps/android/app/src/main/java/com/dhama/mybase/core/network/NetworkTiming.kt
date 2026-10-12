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
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

/** Render Free sleeps after 15 minutes and needs about a minute to accept the next request. */
const val RENDER_SLEEP_AFTER_MS = 15 * 60 * 1000L

/** Connect and first-byte budget for the first call after that sleep, or after process start. */
const val COLD_READ_TIMEOUT_MS = 90_000L

/** Connect and first-byte budget once this process has heard from the server recently. */
const val WARM_READ_TIMEOUT_MS = 30_000L

const val CONNECT_TIMEOUT_MS = COLD_READ_TIMEOUT_MS

/** Cold-start wait for response headers. Warm calls use [WARM_READ_TIMEOUT_MS] instead. */
const val FIRST_READ_TIMEOUT_MS = COLD_READ_TIMEOUT_MS

/**
 * Server SSE comment interval. Matches `SSE_KEEPALIVE_MS` in apps/api (`20_000`).
 * One missed ping must not fail the stream.
 */
const val SERVER_KEEPALIVE_MS = 20_000L

/** Quiet time allowed after two missed keepalives before the body is treated as dead. */
const val STREAM_IDLE_MARGIN_MS = 5_000L

/** 2 × [SERVER_KEEPALIVE_MS] + [STREAM_IDLE_MARGIN_MS]. */
const val STREAM_IDLE_TIMEOUT_MS = SERVER_KEEPALIVE_MS * 2 + STREAM_IDLE_MARGIN_MS

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
    warmReadTimeoutMs: Long = WARM_READ_TIMEOUT_MS,
    awakeWindowMs: Long = RENDER_SLEEP_AFTER_MS,
): OkHttpClient {
    return OkHttpClient.Builder()
        .connectTimeout(connectTimeoutMs, TimeUnit.MILLISECONDS)
        .readTimeout(readTimeoutMs, TimeUnit.MILLISECONDS)
        .writeTimeout(writeTimeoutMs, TimeUnit.MILLISECONDS)
        .addInterceptor(WarmCallTimeouts(signals, warmReadTimeoutMs, awakeWindowMs))
        .eventListenerFactory { WakeEventListener(signals) }
        .build()
}

/**
 * Streaming client. Headers use the cold budget in [firstReadTimeoutMs], unless
 * [WarmCallTimeouts] has already shortened this call to [WARM_READ_TIMEOUT_MS].
 * The body then tightens to [STREAM_IDLE_TIMEOUT_MS] so a paused model does not
 * inherit a limit of zero.
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
    private val lastTrafficAtMs = AtomicLong(0)
    private var hint: Job? = null
    private val _status = MutableStateFlow<String?>(null)
    val status: StateFlow<String?> = _status.asStateFlow()

    /** A successful response arrived, so the next call can use the shorter warm budget. */
    fun noteTraffic(nowMs: Long = System.currentTimeMillis()) {
        lastTrafficAtMs.set(nowMs)
    }

    /** True when a successful response landed inside [windowMs]. Process start counts as idle. */
    fun recentlyAwake(
        nowMs: Long = System.currentTimeMillis(),
        windowMs: Long = RENDER_SLEEP_AFTER_MS,
    ): Boolean {
        val seen = lastTrafficAtMs.get()
        return seen > 0L && nowMs - seen < windowMs
    }

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

/**
 * The shared client's connect and read timeouts cover a cold start. After a recent
 * success they drop to the warm budget, so a dead host does not sit for 90 seconds.
 * SSE still replaces the body timeout with [STREAM_IDLE_TIMEOUT_MS] once headers arrive.
 */
private class WarmCallTimeouts(
    private val signals: NetworkSignals,
    private val warmTimeoutMs: Long,
    private val awakeWindowMs: Long,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val next = if (signals.recentlyAwake(windowMs = awakeWindowMs)) {
            val budget = warmTimeoutMs.toInt()
            chain
                .withConnectTimeout(budget, TimeUnit.MILLISECONDS)
                .withReadTimeout(budget, TimeUnit.MILLISECONDS)
        } else {
            chain
        }
        val response = next.proceed(chain.request())
        if (response.isSuccessful) signals.noteTraffic()
        return response
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
