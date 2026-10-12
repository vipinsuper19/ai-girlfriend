package com.dhama.mybase.core.chat

/**
 * The API rejects a chat message longer than this with 400.
 * Typing and paste both replace the whole field, so this is the only limit.
 */
const val CHAT_MESSAGE_MAX_CHARS = 7000

private const val CHAT_MESSAGE_COUNTER_LEAD = 500

fun chatDraftOverLimit(text: String): Boolean = text.length > CHAT_MESSAGE_MAX_CHARS

/** Null until the draft is within [CHAT_MESSAGE_COUNTER_LEAD] of the limit. */
fun chatDraftLimitNote(text: String): String? {
    val count = text.length
    if (count < CHAT_MESSAGE_MAX_CHARS - CHAT_MESSAGE_COUNTER_LEAD) return null
    val counter = "$count / $CHAT_MESSAGE_MAX_CHARS"
    return when {
        count > CHAT_MESSAGE_MAX_CHARS -> "$counter. Shorten it to send."
        count == CHAT_MESSAGE_MAX_CHARS -> "$counter. That's the limit."
        else -> counter
    }
}
