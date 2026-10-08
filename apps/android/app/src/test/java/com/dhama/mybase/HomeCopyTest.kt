package com.dhama.mybase

import com.dhama.mybase.core.home.exactMessageTime
import com.dhama.mybase.core.home.homeGreeting
import com.dhama.mybase.core.home.presenceLine
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.ZoneOffset

class HomeCopyTest {

    @Test
    fun greetingUsesTheSignedInName() {
        assertEquals("Good morning", homeGreeting(8, "  "))
        assertEquals("Good afternoon, Vipin", homeGreeting(14, " Vipin "))
        assertEquals("Good evening, Vipin", homeGreeting(19, "Vipin"))
    }

    @Test
    fun presenceFollowsTheServerConversation() {
        assertEquals("Active now", presenceLine(linkedToServer = true))
        assertEquals("On this phone", presenceLine(linkedToServer = false))
    }

    @Test
    fun longPressShowsTheFullClockTime() {
        assertEquals(
            "Thu, Jan 1, 1970 · 12:00 AM",
            exactMessageTime(0, ZoneOffset.UTC),
        )
    }
}
