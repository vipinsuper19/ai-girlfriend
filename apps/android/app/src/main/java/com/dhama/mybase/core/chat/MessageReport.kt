package com.dhama.mybase.core.chat

import kotlinx.serialization.Serializable

/**
 * Reasons a person can attach to a report of an assistant reply.
 * Codes are the values sent as `reason`.
 */
enum class ReportReason(val code: String, val label: String) {
    HARMFUL("HARMFUL", "Harmful or unsafe"),
    SEXUAL("SEXUAL", "Sexual content"),
    HATE("HATE", "Hate or harassment"),
    INACCURATE("INACCURATE", "Inaccurate"),
    OTHER("OTHER", "Something else"),
}

const val REPORT_NOTE_MAX = 500

const val REPORT_UNAVAILABLE = "This reply isn't on the server yet, so it can't be reported."

/**
 * Body for `POST /reports`.
 *
 * Confirmed contract: message id, conversation id, reason, and an optional note.
 * `note` is omitted when blank.
 */
@Serializable
data class ReportMessageBody(
    val messageId: Int,
    val conversationId: Int,
    val reason: String,
    val note: String? = null,
)

fun reportUnavailableReason(messageId: Int?, conversationId: Int?): String? {
    if (messageId != null && conversationId != null) return null
    return REPORT_UNAVAILABLE
}

/** Null when the reply has no server id, the chat has no conversation, or the reason is unknown. */
fun reportMessageBody(
    messageId: Int?,
    conversationId: Int?,
    reason: String,
    note: String,
): ReportMessageBody? {
    val id = messageId ?: return null
    val conversation = conversationId ?: return null
    val code = reason.trim()
    if (ReportReason.entries.none { it.code == code }) return null
    val trimmed = note.trim().take(REPORT_NOTE_MAX).ifBlank { null }
    return ReportMessageBody(
        messageId = id,
        conversationId = conversation,
        reason = code,
        note = trimmed,
    )
}
