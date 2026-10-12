package com.dhama.mybase.core.network

/**
 * One assistant reply for a user message the server already stored.
 *
 * apps/api on main does not expose this route yet (checked against the messages
 * controller: list, create, delete, regenerate, and `messages/stream` only).
 * [ApiClient] is the only caller of the path below, so swapping in the real
 * route is a one-method change.
 *
 * Assumed contract:
 *
 * `POST /conversations/:id/messages/reply`
 * Auth: `Authorization: Bearer <access token>`
 * Body: `{}`
 *
 * `200` with the same `data` envelope as the other message routes:
 * ```
 * { "data": { "assistantMessage": { "id", "role": "ASSISTANT", "type", "content", "createdAt" } } }
 * ```
 * The message object matches a stored message row (same fields as regenerate's
 * `assistantMessage`).
 *
 * Does not insert a user row. The newest visible message must already be `USER`;
 * otherwise `409` `{ "message": "The conversation does not end with a user message", "code": "NO_USER_MESSAGE" }`.
 *
 * Persists one assistant message, then charges once the way a finished stream does
 * (`chargeSuccessfulReply`: one `MESSAGES` unit, plus the token estimate). A failed
 * or aborted call does not charge and does not persist a partial reply.
 */
interface LastUserReplyApi {
    suspend fun replyToLastUserMessage(conversationId: Int): RemoteMessage
}

/** Relative path under `/api/v1`, not including the conversation id. */
const val LAST_USER_REPLY_SEGMENT = "messages/reply"

fun lastUserReplyPath(conversationId: Int): String {
    return "conversations/$conversationId/$LAST_USER_REPLY_SEGMENT"
}

/**
 * Stable id for one user send. "Not sent · Retry" repeats this value.
 * Sent as the [IDEMPOTENCY_KEY_HEADER] and as `metadata.clientMessageId`, which
 * `CreateMessageDto.metadata` already accepts. The API stores that object and
 * does not dedupe on it yet.
 */
const val IDEMPOTENCY_KEY_HEADER = "Idempotency-Key"

const val CLIENT_MESSAGE_ID_FIELD = "clientMessageId"
