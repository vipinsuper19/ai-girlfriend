package com.dhama.mybase

import com.dhama.mybase.core.age.AgeGateCopy
import com.dhama.mybase.core.age.DobCommit
import com.dhama.mybase.core.age.DobInputCopy
import com.dhama.mybase.core.age.commitSelectedDob
import com.dhama.mybase.core.age.commitTypedDob
import com.dhama.mybase.core.age.dateOfBirthFromUtcMillis
import com.dhama.mybase.core.age.dobDigits
import com.dhama.mybase.core.age.dobInputPattern
import com.dhama.mybase.core.age.utcMillisFromDateOfBirth
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.util.Locale

class DobDateInputTest {

    private val today = LocalDate.of(2026, 10, 12)
    private val fifteenth = LocalDate.of(1990, 1, 15)

    @Test
    fun patternsFollowTheLocaleShownToTheUser() {
        assertEquals("MM/dd/yyyy", dobInputPattern(Locale.US))
        assertEquals("dd/MM/yyyy", dobInputPattern(Locale.forLanguageTag("en-IN")))
        assertEquals("dd.MM.yyyy", dobInputPattern(Locale.GERMANY))
    }

    @Test
    fun typedDatesCommitInUsIndianAndGermanOrder() {
        assertCommitted("01151990", Locale.US)
        assertCommitted("15011990", Locale.forLanguageTag("en-IN"))
        assertCommitted("15011990", Locale.GERMANY)
    }

    @Test
    fun typedDateIsStoredAsUtcMidnight() {
        val accepted = accept(commitTypedDob("01151990", "MM/dd/yyyy", today))
        assertEquals(fifteenth.toString(), accepted.isoDate)
        assertEquals(utcMillisFromDateOfBirth(fifteenth), accepted.utcMillis)
        assertEquals(fifteenth, dateOfBirthFromUtcMillis(accepted.utcMillis))
    }

    @Test
    fun usDigitsAreNotReadAsDayMonth() {
        val rejected = reject(commitTypedDob("01151990", dobInputPattern(Locale.forLanguageTag("en-IN")), today))
        assertEquals(DobInputCopy.INVALID, rejected.message)
    }

    @Test
    fun emptyInputWaitsWithoutAnError() {
        val rejected = reject(commitTypedDob("", "MM/dd/yyyy", today))
        assertNull(rejected.message)
    }

    @Test
    fun incompleteInputKeepsAnInlineError() {
        val rejected = reject(commitTypedDob("0115", "MM/dd/yyyy", today))
        assertEquals("Enter a complete date (MM/DD/YYYY).", rejected.message)
        val german = reject(commitTypedDob("1501", "dd.MM.yyyy", today))
        assertEquals("Enter a complete date (DD.MM.YYYY).", german.message)
    }

    @Test
    fun impossibleDayIsRejected() {
        val rejected = reject(commitTypedDob("02311990", "MM/dd/yyyy", today))
        assertEquals(DobInputCopy.INVALID, rejected.message)
        val german = reject(commitTypedDob("31021990", "dd.MM.yyyy", today))
        assertEquals(DobInputCopy.INVALID, german.message)
    }

    @Test
    fun futureTypedDateIsRejected() {
        val digits = dobDigits(today.plusDays(1), "MM/dd/yyyy")
        val rejected = reject(commitTypedDob(digits, "MM/dd/yyyy", today))
        assertEquals(AgeGateCopy.FUTURE, rejected.message)
    }

    @Test
    fun underEighteenDateStillCommits() {
        val birth = LocalDate.of(2015, 6, 1)
        val accepted = accept(commitTypedDob(dobDigits(birth, "dd/MM/yyyy"), "dd/MM/yyyy", today))
        assertEquals("2015-06-01", accepted.isoDate)
    }

    @Test
    fun calendarSelectionCommitsUtcMillis() {
        val millis = utcMillisFromDateOfBirth(fifteenth)
        val accepted = accept(commitSelectedDob(millis, today))
        assertEquals("1990-01-15", accepted.isoDate)
        assertEquals(millis, accepted.utcMillis)
        assertEquals(fifteenth, dateOfBirthFromUtcMillis(accepted.utcMillis))
    }

    @Test
    fun missingCalendarSelectionWaitsWithoutAnError() {
        assertNull(reject(commitSelectedDob(null, today)).message)
    }

    @Test
    fun futureCalendarSelectionIsRejected() {
        val millis = utcMillisFromDateOfBirth(today.plusDays(1))
        val rejected = reject(commitSelectedDob(millis, today))
        assertEquals(AgeGateCopy.FUTURE, rejected.message)
    }

    private fun assertCommitted(digits: String, locale: Locale) {
        val accepted = accept(commitTypedDob(digits, dobInputPattern(locale), today))
        assertEquals("1990-01-15", accepted.isoDate)
        assertEquals(utcMillisFromDateOfBirth(fifteenth), accepted.utcMillis)
    }

    private fun accept(result: DobCommit): DobCommit.Accepted {
        assertTrue(result.toString(), result is DobCommit.Accepted)
        return result as DobCommit.Accepted
    }

    private fun reject(result: DobCommit): DobCommit.Rejected {
        assertTrue(result.toString(), result is DobCommit.Rejected)
        return result as DobCommit.Rejected
    }
}
