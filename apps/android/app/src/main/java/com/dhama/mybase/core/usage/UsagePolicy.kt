package com.dhama.mybase.core.usage

import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/**
 * Allowances from apps/api/src/usage/usage-limits.ts. Null means unlimited.
 * The period is the UTC calendar month, matching UsageService.getCurrentPeriod.
 *
 * Metering is not enforced: MessagesService never calls UsageService.consume().
 * The limit card is ready, and chat stays open until that check is wired.
 */
const val METERING_ENFORCED = false

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
