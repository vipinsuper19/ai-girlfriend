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

const val REPORT_NOT_FOUND = "That reply couldn't be found."

const val REPORT_TRY_LATER = "You've sent several reports. Try again later."

const val REPORT_FAILED = "Couldn't send that report."

/** Only an assistant reply can be reported. The person's own messages stay hidden. */
fun canOfferReport(role: String): Boolean = role == "ASSISTANT"

/**
 * Body for `POST /reports`, matching CreateReportDto.
 *
 * `messageId` and `conversationId` are server integers of at least 1.
 * `reason` is one of HARMFUL, SEXUAL, HATE, INACCURATE, OTHER.
 * `note` is omitted when blank and is at most 500 characters.
 */
@Serializable
data class ReportMessageBody(
    val messageId: Int,
    val conversationId: Int,
    val reason: String,
    val note: String? = null,
)

fun reportUnavailableReason(messageId: Int?, conversationId: Int?): String? {
    if (messageId != null && messageId >= 1 && conversationId != null && conversationId >= 1) return null
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
    if (id < 1 || conversation < 1) return null
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
