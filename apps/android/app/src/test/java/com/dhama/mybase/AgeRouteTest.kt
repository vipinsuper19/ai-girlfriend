package com.dhama.mybase

import com.dhama.mybase.core.age.AgeRoute
import com.dhama.mybase.core.age.ageRoute
import com.dhama.mybase.core.age.ageSubject
import com.dhama.mybase.core.age.parseDateOfBirth
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalDate

class AgeRouteTest {

    private val today = LocalDate.of(2026, 10, 12)
    private val adult = LocalDate.of(2000, 1, 1)
    private val minor = LocalDate.of(2015, 6, 1)

    @Test
    fun signedOutStaysOnWelcome() {
        assertEquals(
            AgeRoute.Welcome,
            ageRoute(
                loggedIn = false,
                ageConfirmed = true,
                dateOfBirth = adult,
                storedSubject = "user-a",
                currentSubject = "user-a",
                hasCompanion = true,
                today = today,
            ),
        )
    }

    @Test
    fun googleSignInWithoutStoredAgeGoesToTheConfirmScreen() {
        assertEquals(
            AgeRoute.ConfirmAge,
            ageRoute(
                loggedIn = true,
                ageConfirmed = false,
                dateOfBirth = null,
                storedSubject = "",
                currentSubject = "google-user",
                hasCompanion = true,
                today = today,
            ),
        )
    }

    @Test
    fun existingSessionWithoutConfirmationOrDateOfBirthCannotReachHome() {
        assertEquals(
            AgeRoute.ConfirmAge,
            ageRoute(
                loggedIn = true,
                ageConfirmed = false,
                dateOfBirth = adult,
                storedSubject = "user-a",
                currentSubject = "user-a",
                hasCompanion = true,
                today = today,
            ),
        )
        assertEquals(
            AgeRoute.ConfirmAge,
            ageRoute(
                loggedIn = true,
                ageConfirmed = true,
                dateOfBirth = null,
                storedSubject = "user-a",
                currentSubject = "user-a",
                hasCompanion = true,
                today = today,
            ),
        )
        assertEquals(
            AgeRoute.ConfirmAge,
            ageRoute(
                loggedIn = true,
                ageConfirmed = true,
                dateOfBirth = parseDateOfBirth("not-a-date"),
                storedSubject = "user-a",
                currentSubject = "user-a",
                hasCompanion = false,
                today = today,
            ),
        )
    }

    @Test
    fun blankSubjectCannotPassEvenWhenTheStoredSubjectIsAlsoBlank() {
        assertEquals(
            AgeRoute.ConfirmAge,
            ageRoute(
                loggedIn = true,
                ageConfirmed = true,
                dateOfBirth = adult,
                storedSubject = "",
                currentSubject = "",
                hasCompanion = true,
                today = today,
            ),
        )
    }

    @Test
    fun anotherPersonsConfirmationDoesNotOpenHome() {
        assertEquals(
            AgeRoute.ConfirmAge,
            ageRoute(
                loggedIn = true,
                ageConfirmed = true,
                dateOfBirth = adult,
                storedSubject = "user-a",
                currentSubject = "user-b",
                hasCompanion = true,
                today = today,
            ),
        )
    }

    @Test
    fun under18IsBlockedFromHomeAndOnboarding() {
        assertEquals(
            AgeRoute.ConfirmAge,
            ageRoute(
                loggedIn = true,
                ageConfirmed = true,
                dateOfBirth = minor,
                storedSubject = "user-a",
                currentSubject = "user-a",
                hasCompanion = true,
                today = today,
            ),
        )
        assertEquals(
            AgeRoute.ConfirmAge,
            ageRoute(
                loggedIn = true,
                ageConfirmed = true,
                dateOfBirth = LocalDate.of(2008, 10, 13),
                storedSubject = "user-a",
                currentSubject = "user-a",
                hasCompanion = false,
                today = today,
            ),
        )
    }

    @Test
    fun confirmedAdultReachesHomeOrOnboarding() {
        assertEquals(
            AgeRoute.Home,
            ageRoute(
                loggedIn = true,
                ageConfirmed = true,
                dateOfBirth = adult,
                storedSubject = "user-a",
                currentSubject = "user-a",
                hasCompanion = true,
                today = today,
            ),
        )
        assertEquals(
            AgeRoute.Onboarding,
            ageRoute(
                loggedIn = true,
                ageConfirmed = true,
                dateOfBirth = LocalDate.of(2008, 10, 12),
                storedSubject = "user-a",
                currentSubject = "user-a",
                hasCompanion = false,
                today = today,
            ),
        )
    }

    @Test
    fun subjectPrefersTheAccountId() {
        assertEquals("uid-1", ageSubject("uid-1", "Person@Example.com"))
        assertEquals("person@example.com", ageSubject("  ", "Person@Example.com"))
        assertEquals("", ageSubject(null, null))
        assertNull(parseDateOfBirth(" "))
        assertEquals(adult, parseDateOfBirth("2000-01-01"))
    }
}
