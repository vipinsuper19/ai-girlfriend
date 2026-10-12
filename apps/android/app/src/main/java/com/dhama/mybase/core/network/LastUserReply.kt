package com.dhama.mybase.core.network

import com.dhama.mybase.core.chat.ChatStreamEvent

/**
 * One assistant reply for a user message the server already stored.
 *
 * `POST /conversations/{conversationId}/messages/{userMessageId}/reply/stream`
 * Body: `{}`
 *
 * The body is the same SSE stream as send: `delta`, `done` (carrying the
 * assistant message), `error`, and a `safety` object on `done` when moderation
 * refuses the turn. [com.dhama.mybase.core.chat.consumeSse] parses it.
 *
 * If an assistant reply already follows that user message, the server emits
 * `done` with the existing reply and does not charge. A new reply is charged
 * only when `done` is emitted. The route checks the free-tier cap first
 * (`403 USAGE_LIMIT_EXCEEDED`) and runs moderation.
 *
 * `404` the message is missing or not owned.
 * `409` `NOT_LATEST_USER_MESSAGE` — reload the thread and do not call again.
 * `429` `RATE_LIMITED` with `Retry-After` — wait that long before another try.
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
 * One id per composed user message. Send and "Not sent · Retry" both send it as
 * [IDEMPOTENCY_KEY_HEADER]. Within 24 hours the API returns or continues that
 * same user message instead of inserting another.
 */
const val IDEMPOTENCY_KEY_HEADER = "Idempotency-Key"

const val NOT_LATEST_USER_MESSAGE = "NOT_LATEST_USER_MESSAGE"

const val RATE_LIMITED = "RATE_LIMITED"

enum class RemoteSendFailure {
    UsageLimit,
    RateLimited,
    NotLatest,
    Missing,
    Other,
}

fun remoteSendFailure(status: Int, code: String?): RemoteSendFailure {
    return when {
        status == 403 || code == "USAGE_LIMIT_EXCEEDED" -> RemoteSendFailure.UsageLimit
        status == 429 || code == RATE_LIMITED -> RemoteSendFailure.RateLimited
        status == 409 || code == NOT_LATEST_USER_MESSAGE -> RemoteSendFailure.NotLatest
        status == 404 -> RemoteSendFailure.Missing
        else -> RemoteSendFailure.Other
    }
}

fun rateLimitNotice(retryAfterSeconds: Int): String {
    val seconds = retryAfterSeconds.coerceAtLeast(1)
    val unit = if (seconds == 1) "second" else "seconds"
    return "Too many requests. Try again in $seconds $unit."
}
