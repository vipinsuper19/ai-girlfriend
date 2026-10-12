package com.dhama.mybase

import com.dhama.mybase.core.age.AgeGateCopy
import com.dhama.mybase.core.age.ageYears
import com.dhama.mybase.core.age.dateOfBirthFromUtcMillis
import com.dhama.mybase.core.age.evaluateAgeGate
import com.dhama.mybase.core.age.isAtLeastAge
import com.dhama.mybase.core.age.utcMillisFromDateOfBirth
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class AgeGateTest {

    private val today = LocalDate.of(2026, 10, 12)

    @Test
    fun ageIsCompletedYears() {
        assertEquals(18, ageYears(LocalDate.of(2008, 10, 12), today))
        assertEquals(17, ageYears(LocalDate.of(2008, 10, 13), today))
        assertEquals(19, ageYears(LocalDate.of(2007, 1, 1), today))
        assertEquals(0, ageYears(today, today))
        assertEquals(0, ageYears(today.plusDays(1), today))
        assertEquals(-1, ageYears(today.plusYears(1), today))
        assertFalse(isAtLeastAge(today.plusDays(1), today))
    }

    @Test
    fun eighteenthBirthdayIsAllowedTheDayItHappens() {
        val decision = evaluateAgeGate(confirmedAdult = true, dateOfBirth = LocalDate.of(2008, 10, 12), today = today)
        assertTrue(decision.allowed)
        assertNull(decision.dateOfBirthMessage)
        assertNull(decision.confirmationMessage)
        assertTrue(isAtLeastAge(LocalDate.of(2008, 10, 12), today))
    }

    @Test
    fun dayBeforeEighteenthBirthdayIsBlocked() {
        val birth = LocalDate.of(2008, 10, 13)
        val decision = evaluateAgeGate(confirmedAdult = true, dateOfBirth = birth, today = today)
        assertFalse(decision.allowed)
        assertEquals(17, ageYears(birth, today))
        assertEquals(AgeGateCopy.UNDER_AGE, decision.dateOfBirthMessage)
        assertNull(decision.confirmationMessage)
    }

    @Test
    fun uncheckedBoxBlocksAnAdult() {
        val decision = evaluateAgeGate(confirmedAdult = false, dateOfBirth = LocalDate.of(2000, 1, 1), today = today)
        assertFalse(decision.allowed)
        assertEquals(AgeGateCopy.CONFIRM, decision.confirmationMessage)
        assertNull(decision.dateOfBirthMessage)
    }

    @Test
    fun missingDateAndUncheckedBoxBothExplainWhy() {
        val decision = evaluateAgeGate(confirmedAdult = false, dateOfBirth = null, today = today)
        assertFalse(decision.allowed)
        assertEquals(AgeGateCopy.CONFIRM, decision.confirmationMessage)
        assertEquals(AgeGateCopy.ENTER_DATE, decision.dateOfBirthMessage)
    }

    @Test
    fun futureDateIsBlockedEvenWhenTheBoxIsChecked() {
        val decision = evaluateAgeGate(confirmedAdult = true, dateOfBirth = today.plusDays(1), today = today)
        assertFalse(decision.allowed)
        assertEquals(AgeGateCopy.FUTURE, decision.dateOfBirthMessage)
    }

    @Test
    fun underAgeAndUncheckedBoxReportBothProblems() {
        val decision = evaluateAgeGate(confirmedAdult = false, dateOfBirth = LocalDate.of(2015, 6, 1), today = today)
        assertFalse(decision.allowed)
        assertEquals(AgeGateCopy.CONFIRM, decision.confirmationMessage)
        assertEquals(AgeGateCopy.UNDER_AGE, decision.dateOfBirthMessage)
    }

    @Test
    fun leapDayBirthdayCountsAfterTheAnniversary() {
        val birth = LocalDate.of(2008, 2, 29)
        val dayBefore = LocalDate.of(2026, 2, 28)
        val anniversary = LocalDate.of(2026, 3, 1)
        assertEquals(17, ageYears(birth, dayBefore))
        assertFalse(isAtLeastAge(birth, dayBefore))
        assertEquals(AgeGateCopy.UNDER_AGE, evaluateAgeGate(true, birth, dayBefore).dateOfBirthMessage)
        assertEquals(18, ageYears(birth, anniversary))
        assertTrue(isAtLeastAge(birth, anniversary))
        assertTrue(evaluateAgeGate(true, birth, anniversary).allowed)
    }

    @Test
    fun pickerMillisRoundTripKeepsTheCalendarDate() {
        val date = LocalDate.of(2008, 10, 12)
        assertEquals(date, dateOfBirthFromUtcMillis(utcMillisFromDateOfBirth(date)))
        assertEquals(LocalDate.of(2000, 2, 29), dateOfBirthFromUtcMillis(utcMillisFromDateOfBirth(LocalDate.of(2000, 2, 29))))
    }
}
