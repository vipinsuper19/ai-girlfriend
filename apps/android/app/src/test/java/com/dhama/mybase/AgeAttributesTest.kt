package com.dhama.mybase

import com.dhama.mybase.core.age.isAgeAttributeKey
import com.dhama.mybase.core.age.withoutAgeAttributes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AgeAttributesTest {

    private val dob = "1991-03-17"

    @Test
    fun analyticsAndCrashlyticsKeysCannotCarryAge() {
        val safe = withoutAgeAttributes(
            mapOf(
                "screen" to "chat",
                "dateOfBirth" to dob,
                "date_of_birth" to dob,
                "date-of-birth" to dob,
                "dob" to dob,
                "DOB" to dob,
                "birthDate" to dob,
                "birth_date" to dob,
                "birthday" to dob,
                "ageConfirmedAt" to "2026-10-12T15:04:05Z",
                "age_confirmed_at" to "2026-10-12T15:04:05Z",
                "age_confirmed_18" to "true",
                "age_subject" to "uid",
                "ageSubject" to "uid",
                "user_age" to "34",
                "userAge" to "34",
                "age" to "34",
            ),
        )
        assertEquals(mapOf("screen" to "chat"), safe)
    }

    @Test
    fun ordinaryKeysAreNotTreatedAsAge() {
        listOf("screen", "plan", "page", "coverage", "storage", "agent", "message").forEach { key ->
            assertFalse(key, isAgeAttributeKey(key))
        }
        assertTrue(isAgeAttributeKey("dateOfBirth"))
        assertTrue(isAgeAttributeKey("dob"))
    }
}
