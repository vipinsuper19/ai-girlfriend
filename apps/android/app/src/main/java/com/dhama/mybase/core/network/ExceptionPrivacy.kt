package com.dhama.mybase.core.network

import kotlin.coroutines.cancellation.CancellationException

private val emailValue = Regex(
    "[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}",
    RegexOption.IGNORE_CASE,
)

private val phoneValue = Regex(
    """(?<!\d)(?:\+\d{1,3}[\s.-]*)?(?:\(\d{3}\)|\d{3})[\s.-]*\d{3}[\s.-]*\d{4}(?!\d)|(?<!\d)\+\d{10,15}(?!\d)|(?<!\d)\d{10,15}(?!\d)""",
)

private val payloadField = Regex(
    """(?i)"(content|prompt|system_prompt|systemPrompt|message|body|text)"\s*:""",
)

/**
 * True when [text] is chat content, a prompt, or a request/response body.
 * Short operational errors such as "Usage limit exceeded for MESSAGES" stay false.
 */
fun containsUserPayload(text: String): Boolean {
    if (text.length > 200) return true
    if ('\n' in text || '\r' in text) return true
    if ('{' in text || '}' in text) return true
    if ("JSON input" in text || "Unexpected JSON" in text) return true
    if (payloadField.containsMatchIn(text)) return true
    if (emailValue.containsMatchIn(text)) return true
    if (phoneValue.containsMatchIn(text)) return true
    return false
}

/** True when [text] is, or quotes, a chat line, prompt, or body from the same payload. */
fun echoesUserPayload(text: String, echoed: Collection<String>): Boolean {
    val trimmed = text.trim()
    if (trimmed.isEmpty()) return false
    return echoed.any { raw ->
        val echo = raw.trim()
        echo.isNotEmpty() && (echo == trimmed || (echo.length >= 8 && echo in trimmed))
    }
}

/** Exception text that is safe to leave on an uncaught crash. */
fun crashSafeExceptionMessage(raw: String?): String {
    val text = raw?.trim().orEmpty()
    if (text.isEmpty() || containsUserPayload(text)) return "Request failed"
    return text
}

/**
 * A transport failure with the original stack and no cause chain.
 * The cause is dropped so a body or prompt attached to the underlying error cannot reach Crashlytics.
 */
fun scrubTransportFailure(error: Throwable): Exception {
    val message = if (serializationFailure(error)) {
        "Request failed"
    } else {
        crashSafeExceptionMessage(error.message)
    }
    val failure = TransportFailure(message)
    failure.stackTrace = error.stackTrace
    return failure
}

/** Parser failures can embed the JSON input. Never forward those messages. */
private fun serializationFailure(error: Throwable): Boolean {
    var current: Throwable? = error
    while (current != null) {
        if ("kotlinx.serialization" in current.javaClass.name) return true
        current = current.cause
    }
    return false
}

/**
 * Keeps cancellation as cancellation, but drops any cause.
 * A cause can hold an OkHttp or parser error whose message is the request or response body.
 */
fun scrubCancellation(error: CancellationException): CancellationException {
    val raw = error.message?.trim().orEmpty()
    val safe = if (raw.isEmpty() || containsUserPayload(raw)) "Stopped" else raw
    if (safe == raw && error.cause == null && error.suppressed.isEmpty()) return error
    val clean = CancellationException(safe)
    clean.stackTrace = error.stackTrace
    return clean
}

class TransportFailure(message: String) : Exception(message)
