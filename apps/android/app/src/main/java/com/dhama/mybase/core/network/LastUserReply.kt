package com.dhama.mybase.core.network

import com.dhama.mybase.core.age.AGE_REQUIRED
import com.dhama.mybase.core.chat.ChatStreamEvent

/**
 * One assistant reply for a user message the server already stored.
 *
 * `POST /conversations/{conversationId}/messages/{userMessageId}/reply/stream`
 * Body: `{}`
 *
 * SSE framing matches send (`delta`, then `done` carrying the assistant
 * message). [com.dhama.mybase.core.chat.consumeSse] parses it. A reply that
 * already follows that user line is a single `done` and is not charged.
 * Dropping the connection aborts the reply and is not charged. A new reply
 * is charged only when `done` arrives without a safety notice.
 *
 * These failures are JSON, before any stream bytes:
 * `404` the message is missing, deleted, or not a user line in this conversation.
 * `409` `NOT_LATEST_USER_MESSAGE` — reload the thread and do not call again.
 * `403` `USAGE_LIMIT_EXCEEDED` — show the usage-limit state.
 * `403` `AGE_REQUIRED` — the client re-attests once when the on-device gate already passed, then retries this call. Otherwise it shows the age gate.
 * `429` `RATE_LIMITED` — wait for `Retry-After`, or `retryAfterSeconds` in the body.
 */
interface LastUserReplyApi {
    suspend fun replyToLastUserMessage(
        conversationId: Int,
        userMessageId: Int,
        onEvent: suspend (ChatStreamEvent) -> Unit,
    )
}

fun lastUserReplyPath(conversationId: Int, userMessageId: Int): String {
    return "conversations/$conversationId/messages/$userMessageId/reply/stream"
}

/**
 * One UUID per composed user message, sent as [IDEMPOTENCY_KEY_HEADER] on
 * `POST .../messages` and `POST .../messages/stream`.
 *
 * Blank is ignored. Anything that is not a UUID is `400 INVALID_IDEMPOTENCY_KEY`,
 * so local ids such as `server-1` or `greeting` are never sent. Within 24 hours
 * the same key returns the original user line and does not charge again. The
 * same key on another conversation is `409 IDEMPOTENCY_KEY_REUSED`, so a retry
 * reuses the key only for the conversation it was first sent to.
 */
const val IDEMPOTENCY_KEY_HEADER = "Idempotency-Key"

const val NOT_LATEST_USER_MESSAGE = "NOT_LATEST_USER_MESSAGE"

const val RATE_LIMITED = "RATE_LIMITED"

const val INVALID_IDEMPOTENCY_KEY = "INVALID_IDEMPOTENCY_KEY"

const val IDEMPOTENCY_KEY_REUSED = "IDEMPOTENCY_KEY_REUSED"

/** Same shape the API accepts: 8-4-4-4-12 hex, either case. The wire value is lowercase. */
private val IDEMPOTENCY_UUID = Regex(
    "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
)

fun isIdempotencyUuid(value: String?): Boolean {
    return value != null && IDEMPOTENCY_UUID.matches(value.trim())
}

/** Lowercase UUID, or null when the header must be omitted. */
fun idempotencyKeyOrNull(value: String?): String? {
    val trimmed = value?.trim()?.takeIf { isIdempotencyUuid(it) } ?: return null
    return trimmed.lowercase()
}

/**
 * The key to reuse for [conversationId], or null when the caller must mint a
 * new UUID. [boundConversationId] is the conversation this key was already
 * sent to, if this process still knows it.
 */
fun idempotencyKeyFor(
    requested: String?,
    conversationId: Int,
    boundConversationId: Int?,
): String? {
    val key = idempotencyKeyOrNull(requested) ?: return null
    if (boundConversationId != null && boundConversationId != conversationId) return null
    return key
}

enum class RemoteSendFailure {
    UsageLimit,
    AgeRequired,
    RateLimited,
    NotLatest,
    Missing,
    InvalidKey,
    KeyReused,
    Other,
}

fun remoteSendFailure(status: Int, code: String?): RemoteSendFailure {
    return when {
        code == AGE_REQUIRED -> RemoteSendFailure.AgeRequired
        status == 403 || code == "USAGE_LIMIT_EXCEEDED" -> RemoteSendFailure.UsageLimit
        status == 429 || code == RATE_LIMITED -> RemoteSendFailure.RateLimited
        code == IDEMPOTENCY_KEY_REUSED -> RemoteSendFailure.KeyReused
        code == INVALID_IDEMPOTENCY_KEY -> RemoteSendFailure.InvalidKey
        code == NOT_LATEST_USER_MESSAGE -> RemoteSendFailure.NotLatest
        status == 404 -> RemoteSendFailure.Missing
        else -> RemoteSendFailure.Other
    }
}

fun rateLimitNotice(retryAfterSeconds: Int): String {
    val seconds = retryAfterSeconds.coerceAtLeast(1)
    val unit = if (seconds == 1) "second" else "seconds"
    return "Too many requests. Try again in $seconds $unit."
}
