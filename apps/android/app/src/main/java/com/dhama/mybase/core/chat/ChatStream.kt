package com.dhama.mybase.core.chat

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

sealed interface ChatStreamEvent {
    data class UserMessage(val content: String) : ChatStreamEvent
    data class Delta(val content: String) : ChatStreamEvent
    data class Done(val content: String) : ChatStreamEvent
    data class Error(val message: String, val code: String? = null) : ChatStreamEvent
}

@Serializable
private data class SseData(
    val type: String = "",
    val content: String? = null,
    val message: SseMessageBody? = null,
)

@Serializable
private data class SseMessageBody(
    val content: String? = null,
)

@Serializable
private data class ErrorEnvelope(
    val message: String? = null,
    val code: String? = null,
)

/**
 * Pulls complete SSE blocks out of a growing buffer. Returns the events and the
 * unparsed tail. Matches the wire format from MessagesController: event name,
 * then a JSON data line, then a blank line.
 */
fun consumeSse(buffer: String): Pair<List<ChatStreamEvent>, String> {
    val events = mutableListOf<ChatStreamEvent>()
    var rest = buffer.replace("\r\n", "\n")
    while (true) {
        val splitAt = rest.indexOf("\n\n")
        if (splitAt < 0) break
        val block = rest.substring(0, splitAt)
        rest = rest.substring(splitAt + 2)
        parseBlock(block)?.let(events::add)
    }
    return events to rest
}

private val json = Json { ignoreUnknownKeys = true }

private fun parseBlock(block: String): ChatStreamEvent? {
    if (block.isBlank() || block.startsWith(":")) return null
    var eventName = ""
    val data = StringBuilder()
    block.lineSequence().forEach { line ->
        when {
            line.startsWith("event:") -> eventName = line.substringAfter("event:").trim()
            line.startsWith("data:") -> {
                if (data.isNotEmpty()) data.append('\n')
                data.append(line.substringAfter("data:").trim())
            }
        }
    }
    if (data.isEmpty()) return null
    val raw = data.toString()
    val payload = runCatching { json.decodeFromString<SseData>(raw) }.getOrNull()
    val type = eventName.ifBlank { payload?.type.orEmpty() }
    val text = payload?.content ?: payload?.message?.content.orEmpty()
    return when (type) {
        "message" -> ChatStreamEvent.UserMessage(text)
        "delta" -> ChatStreamEvent.Delta(text)
        "done" -> ChatStreamEvent.Done(text.ifBlank { payload?.message?.content.orEmpty() })
        "error" -> {
            val envelope = runCatching { json.decodeFromString<ErrorEnvelope>(raw) }.getOrNull()
            ChatStreamEvent.Error(
                envelope?.message ?: text.ifBlank { "Streaming failed" },
                envelope?.code,
            )
        }
        else -> null
    }
}

/**
 * On-device reply used until the app holds an API access token. Chunks are the
 * pieces a streaming bubble appends.
 */
fun localReply(name: String, relationship: String, traits: List<String>, userText: String): String {
    val heard = userText.trim().replace(Regex("\\s+"), " ")
    val clip = if (heard.length > 160) heard.take(160).trimEnd() + "…" else heard
    val trait = traits.firstOrNull()?.lowercase() ?: "close"
    val who = relationship.lowercase()
    return "\"$clip\" — I heard you. I'm $name, your $who, and the $trait part of me is right here. Tell me the rest."
}

fun chunkReply(text: String): List<String> {
    if (text.isEmpty()) return emptyList()
    return text.split(Regex("(?<=\\s)"))
        .filter { it.isNotEmpty() }
}

/** Centred chat marker after a personality save. Not a server message row. */
fun personalityUpdatedLine(name: String): String {
    val who = name.trim()
    return if (who.isEmpty()) "Her personality was updated" else "$who's personality was updated"
}

enum class StreamRecovery {
    Finished,
    Fallback,
    Failed,
}

/**
 * A normal POST is safe only when the stream never accepted the user's line.
 * After that, another POST would store the same message twice.
 */
fun streamRecovery(userAccepted: Boolean, replyStarted: Boolean, finished: Boolean): StreamRecovery {
    if (finished) return StreamRecovery.Finished
    if (!userAccepted && !replyStarted) return StreamRecovery.Fallback
    return StreamRecovery.Failed
}

/** The server already stored the user's line, so the bubble must not be posted again. */
const val DROPPED_DELIVERY = "DROPPED"

fun replyFailureDelivery(userAccepted: Boolean, replyStarted: Boolean, finished: Boolean): String {
    return if (streamRecovery(userAccepted, replyStarted, finished) == StreamRecovery.Failed) {
        DROPPED_DELIVERY
    } else {
        "FAILED"
    }
}

fun retriesByReload(delivery: String): Boolean = delivery == DROPPED_DELIVERY

fun retryCaption(delivery: String): String {
    return if (retriesByReload(delivery)) "Reply didn't finish · Retry" else "Not sent · Retry"
}

/** Phone-only notes and lines the server never accepted stay when the thread is reloaded. */
fun keptOnReload(delivery: String, kind: String): Boolean {
    return kind == "SYSTEM" || delivery == "FAILED"
}

/** Shown once, under a reply that arrived from the non-streaming route. */
fun droppedStreamLine(): String {
    return "The live connection dropped, so this reply arrived all at once."
}
