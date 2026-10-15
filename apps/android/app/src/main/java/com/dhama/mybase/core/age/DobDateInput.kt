package com.dhama.mybase.core.age

import java.time.DateTimeException
import java.time.LocalDate
import java.time.chrono.Chronology
import java.time.format.DateTimeFormatterBuilder
import java.time.format.FormatStyle
import java.util.Locale

const val DOB_PICKER_MIN_YEAR = 1900

object DobInputCopy {
    const val INVALID = "Enter a valid date."

    fun incomplete(pattern: String): String {
        return "Enter a complete date (${pattern.uppercase(Locale.US)})."
    }
}

sealed class DobCommit {
    data class Accepted(val isoDate: String, val utcMillis: Long) : DobCommit()

    /** [message] is null when the field is still empty, so the dialog can wait without an error. */
    data class Rejected(val message: String?) : DobCommit()
}

fun dobYearRange(today: LocalDate): IntRange = DOB_PICKER_MIN_YEAR..today.year

/**
 * Short date pattern shown in the date field, normalized the same way Material3 normalizes a
 * locale's [FormatStyle.SHORT] pattern: two-digit day and month, four-digit year, and a `/`, `-`,
 * or `.` delimiter. Examples: `MM/dd/yyyy`, `dd/MM/yyyy`, `dd.MM.yyyy`.
 */
fun dobInputPattern(locale: Locale): String {
    val localeFormat = DateTimeFormatterBuilder.getLocalizedDateTimePattern(
        FormatStyle.SHORT,
        null,
        Chronology.ofLocale(locale),
        locale,
    )
    return datePatternAsInputFormat(localeFormat)
}

/** Digits for [date] in [pattern] order, without delimiters. `1990-01-15` in `MM/dd/yyyy` is `01151990`. */
fun dobDigits(date: LocalDate, pattern: String): String {
    val skeleton = patternSkeleton(pattern)
    val out = StringBuilder(skeleton.length)
    var index = 0
    while (index < skeleton.length) {
        val marker = skeleton[index]
        var end = index + 1
        while (end < skeleton.length && skeleton[end] == marker) end++
        val value = when (marker) {
            'y' -> date.year
            'M' -> date.monthValue
            'd' -> date.dayOfMonth
            else -> return ""
        }
        out.append(value.toString().padStart(end - index, '0'))
        index = end
    }
    return out.toString()
}

/**
 * Parses [digits] with the pattern shown to the user. Dates are interpreted as a calendar day and
 * stored as UTC midnight so the day does not shift with the device time zone.
 */
fun commitTypedDob(
    digits: String,
    pattern: String,
    today: LocalDate,
    yearRange: IntRange = dobYearRange(today),
): DobCommit {
    val skeleton = patternSkeleton(pattern)
    if (digits.isEmpty()) return DobCommit.Rejected(null)
    if (skeleton.length != 8 || !digits.all(Char::isDigit) || digits.length > skeleton.length) {
        return DobCommit.Rejected(DobInputCopy.INVALID)
    }
    if (digits.length < skeleton.length) {
        return DobCommit.Rejected(DobInputCopy.incomplete(pattern))
    }
    val date = try {
        LocalDate.of(
            fieldValue(digits, skeleton, 'y'),
            fieldValue(digits, skeleton, 'M'),
            fieldValue(digits, skeleton, 'd'),
        )
    } catch (_: DateTimeException) {
        return DobCommit.Rejected(DobInputCopy.INVALID)
    }
    return acceptDob(date, today, yearRange)
}

/** Commits a calendar selection. [selectedDateMillis] is the UTC start of the selected day. */
fun commitSelectedDob(
    selectedDateMillis: Long?,
    today: LocalDate,
    yearRange: IntRange = dobYearRange(today),
): DobCommit {
    if (selectedDateMillis == null) return DobCommit.Rejected(null)
    return acceptDob(dateOfBirthFromUtcMillis(selectedDateMillis), today, yearRange)
}

/** A parsed day, including future days. Null when [digits] is not a real date in [pattern]. */
fun parseDobDigits(digits: String, pattern: String): LocalDate? {
    val skeleton = patternSkeleton(pattern)
    if (skeleton.length != 8 || digits.length != skeleton.length || !digits.all(Char::isDigit)) {
        return null
    }
    return try {
        LocalDate.of(
            fieldValue(digits, skeleton, 'y'),
            fieldValue(digits, skeleton, 'M'),
            fieldValue(digits, skeleton, 'd'),
        )
    } catch (_: DateTimeException) {
        null
    }
}

private fun acceptDob(date: LocalDate, today: LocalDate, yearRange: IntRange): DobCommit {
    if (date.isAfter(today)) return DobCommit.Rejected(AgeGateCopy.FUTURE)
    if (date.year !in yearRange) return DobCommit.Rejected(DobInputCopy.INVALID)
    return DobCommit.Accepted(date.toString(), utcMillisFromDateOfBirth(date))
}

private fun patternDelimiter(pattern: String): Char? {
    return pattern.firstOrNull { it == '/' || it == '-' || it == '.' }
}

private fun patternSkeleton(pattern: String): String {
    val delimiter = patternDelimiter(pattern) ?: return pattern
    return pattern.replace(delimiter.toString(), "")
}

private fun fieldValue(digits: String, skeleton: String, marker: Char): Int {
    val start = skeleton.indexOf(marker)
    val width = skeleton.count { it == marker }
    return digits.substring(start, start + width).toInt()
}

/**
 * Same cleanup as Material3 `datePatternAsInputFormat`: keep `d`, `M`, `y` and `/.-`, force
 * `dd`, `MM`, and `yyyy`, and drop a trailing dot.
 */
internal fun datePatternAsInputFormat(localeFormat: String): String {
    return localeFormat
        .replace(Regex("[^dMy/\\-.]"), "")
        .replace(Regex("d{1,2}"), "dd")
        .replace(Regex("M{1,2}"), "MM")
        .replace(Regex("y{1,4}"), "yyyy")
        .replace("My", "M/y")
        .removeSuffix(".")
}
