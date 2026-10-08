package com.dhama.mybase.core.memory

data class NoticedMemory(
    val type: String,
    val content: String,
    val importance: Int,
    val confidence: Float,
)

/**
 * Pulls at most one memory out of something the user just said.
 * The whole message is not stored. Types match the API enum.
 */
fun noticeFromMessage(text: String): NoticedMemory? {
    val heard = text.trim().replace(Regex("\\s+"), " ")
    if (heard.length < 3) return null
    val name = NAME.find(heard)
    if (name != null) {
        val value = name.groupValues[1].trim()
        return NoticedMemory("PROFILE", "Your name is $value", 90, 0.9f)
    }
    val preference = PREFERENCE.find(heard)
    if (preference != null) {
        val verb = preference.groupValues[1].lowercase()
        val value = preference.groupValues[2].trim().trimEnd('.', '!', '?')
        val stance = if (verb == "hate" || verb == "dislike") "don't like" else "like"
        return NoticedMemory("PREFERENCE", "You $stance $value", 72, 0.8f)
    }
    val relation = RELATION.find(heard)
    if (relation != null) {
        val who = relation.groupValues[1].lowercase()
        return NoticedMemory("RELATIONSHIP", "You mentioned your $who", 88, 0.74f)
    }
    return null
}

fun importanceReading(score: Int): String {
    val clamped = score.coerceIn(0, 100)
    val line = when {
        clamped >= 80 -> "she'll bring this up unprompted"
        clamped >= 50 -> "she'll use this when it fits"
        else -> "she keeps this quietly"
    }
    return "$clamped — $line"
}

fun memoryTypeLabel(type: String): String = when (type) {
    "PROFILE" -> "Personal"
    "PREFERENCE" -> "Preference"
    "RELATIONSHIP" -> "Relationship"
    "CONVERSATION" -> "Conversation"
    "FACT" -> "Fact"
    else -> type
}

data class RankedMemory(
    val content: String,
    val importance: Int,
    val createdAtEpochMs: Long,
)

data class MemoryHighlight(
    val content: String,
    val thisWeek: Boolean,
)

/** Prefer something she kept this week. Otherwise the memory she holds most strongly. */
fun pickMemoryHighlight(items: List<RankedMemory>, nowEpochMs: Long): MemoryHighlight? {
    if (items.isEmpty()) return null
    val weekAgo = nowEpochMs - 7L * DAY_MS
    val recent = items.filter { it.createdAtEpochMs >= weekAgo }
    val pool = recent.ifEmpty { items }
    val chosen = pool.maxBy { it.importance }
    return MemoryHighlight(chosen.content, chosen.createdAtEpochMs >= weekAgo)
}

fun highlightLine(highlight: MemoryHighlight): String {
    return if (highlight.thisWeek) {
        "She remembered this week: ${highlight.content}"
    } else {
        "She remembers: ${highlight.content}"
    }
}

fun togetherLine(relationship: String, createdAtEpochMs: Long, nowEpochMs: Long): String {
    val days = ((nowEpochMs - createdAtEpochMs) / DAY_MS).coerceAtLeast(0)
    val duration = when {
        days < 1 -> "since today"
        days < 7 -> "$days days together"
        days < 14 -> "1 week together"
        else -> "${days / 7} weeks together"
    }
    return "Your ${relationship.lowercase()} · $duration"
}

private val NAME = Regex("^(?:my name is|i am|i'm)\\s+([A-Za-z][A-Za-z '\\-]{0,40})$", RegexOption.IGNORE_CASE)
private val PREFERENCE = Regex("^(?:i)\\s+(like|love|prefer|hate|dislike)\\s+(.{2,80})$", RegexOption.IGNORE_CASE)
private val RELATION = Regex("\\bmy\\s+(sister|brother|mom|mother|dad|father|friend|partner|wife|husband)\\b", RegexOption.IGNORE_CASE)
/** Matches the API's limit on an edited memory. */
const val MEMORY_CONTENT_MAX = 2000

private const val DAY_MS = 86_400_000L
