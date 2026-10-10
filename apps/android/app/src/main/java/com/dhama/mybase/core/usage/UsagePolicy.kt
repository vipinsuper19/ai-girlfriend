package com.dhama.mybase.core.usage

import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/**
 * Allowances from apps/api/src/usage/usage-limits.ts. Null means unlimited.
 * The period is the UTC calendar month, matching UsageService.getCurrentPeriod.
 *
 * A server snapshot comes from GET /usage/summary. Message sends and voice
 * replies call UsageService.consume(), and a limit error closes that action.
 */
const val USAGE_LIMIT_CODE = "USAGE_LIMIT_EXCEEDED"

const val FREE_MESSAGE_LIMIT = 100
const val FREE_VOICE_MINUTES = 10
const val FREE_IMAGE_LIMIT = 5
const val NEARING_RATIO = 0.8

enum class UsageLevel {
    OK,
    NEARING,
    WALL,
}

data class CountedMessage(
    val role: String,
    val createdAtEpochMs: Long,
    val durationMs: Long,
)

data class MonthUsage(
    val messages: Int,
    val voiceMinutes: Int,
    val periodStartEpochMs: Long,
    val resetEpochMs: Long,
)

data class PlanUsage(
    val messagesUsed: Int,
    val messagesLimit: Int?,
    val voiceUsed: Int,
    val voiceLimit: Int?,
    val imagesUsed: Int,
    val imagesLimit: Int?,
    val periodStartEpochMs: Long,
    val resetEpochMs: Long,
    val fromServer: Boolean,
)

fun phonePlanUsage(usage: MonthUsage): PlanUsage {
    return PlanUsage(
        messagesUsed = usage.messages,
        messagesLimit = FREE_MESSAGE_LIMIT,
        voiceUsed = usage.voiceMinutes,
        voiceLimit = FREE_VOICE_MINUTES,
        imagesUsed = 0,
        imagesLimit = FREE_IMAGE_LIMIT,
        periodStartEpochMs = usage.periodStartEpochMs,
        resetEpochMs = usage.resetEpochMs,
        fromServer = false,
    )
}

fun planCaption(fromServer: Boolean): String {
    return if (fromServer) "This month on your plan." else "This month on this phone."
}

fun messageAllowanceClosed(usage: PlanUsage?): Boolean {
    val limit = usage?.messagesLimit ?: return false
    return usage.messagesUsed >= limit
}

fun voiceAllowanceClosed(usage: PlanUsage?): Boolean {
    val limit = usage?.voiceLimit ?: return false
    return usage.voiceUsed >= limit
}

fun showMessageWall(usage: PlanUsage?, blocked: Boolean): Boolean {
    return blocked || messageAllowanceClosed(usage)
}

fun usageLimitNotice(message: String): String {
    return when {
        "VOICE_MINUTES" in message -> "You've used your voice minutes for this month."
        "IMAGE" in message -> "You've used your images for this month."
        else -> "You've used your messages for this month."
    }
}

fun usageLimitBlocksMessages(message: String): Boolean {
    return "VOICE_MINUTES" !in message && "IMAGE" !in message
}

fun utcMonthStart(nowEpochMs: Long): Long {
    val date = Instant.ofEpochMilli(nowEpochMs).atZone(ZoneOffset.UTC).toLocalDate()
    return date.withDayOfMonth(1).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
}

fun utcMonthReset(nowEpochMs: Long): Long {
    val start = Instant.ofEpochMilli(utcMonthStart(nowEpochMs)).atZone(ZoneOffset.UTC)
    return start.plusMonths(1).toInstant().toEpochMilli()
}

fun resetLabel(resetEpochMs: Long): String {
    val date = Instant.ofEpochMilli(resetEpochMs).atZone(ZoneOffset.UTC).toLocalDate()
    return date.format(DateTimeFormatter.ofPattern("d MMM"))
}

fun usageLevel(used: Int, limit: Int?): UsageLevel {
    if (limit == null) return UsageLevel.OK
    if (used >= limit) return UsageLevel.WALL
    if (limit == 0) return UsageLevel.WALL
    if (used.toDouble() / limit >= NEARING_RATIO) return UsageLevel.NEARING
    return UsageLevel.OK
}

fun monthUsage(messages: List<CountedMessage>, nowEpochMs: Long): MonthUsage {
    val start = utcMonthStart(nowEpochMs)
    val reset = utcMonthReset(nowEpochMs)
    val inPeriod = messages.filter { it.role == "USER" && it.createdAtEpochMs in start until reset }
    val voiceMs = inPeriod.sumOf { it.durationMs.coerceAtLeast(0) }
    val voiceMinutes = if (voiceMs == 0L) 0 else ((voiceMs + 59_999L) / 60_000L).toInt()
    return MonthUsage(
        messages = inPeriod.size,
        voiceMinutes = voiceMinutes,
        periodStartEpochMs = start,
        resetEpochMs = reset,
    )
}
