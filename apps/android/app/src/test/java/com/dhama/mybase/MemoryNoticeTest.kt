package com.dhama.mybase

import com.dhama.mybase.core.memory.RankedMemory
import com.dhama.mybase.core.memory.highlightLine
import com.dhama.mybase.core.memory.importanceReading
import com.dhama.mybase.core.memory.noticeFromMessage
import com.dhama.mybase.core.memory.pickMemoryHighlight
import com.dhama.mybase.core.memory.togetherLine
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MemoryNoticeTest {

    @Test
    fun noticesANameWithoutStoringTheMessage() {
        val noticed = noticeFromMessage("My name is Mira")
        assertEquals("PROFILE", noticed?.type)
        assertEquals("Your name is Mira", noticed?.content)
        assertEquals(90, noticed?.importance)
    }

    @Test
    fun noticesAPreferenceAndARelationship() {
        assertEquals("PREFERENCE", noticeFromMessage("I like late coffee")?.type)
        assertEquals("You like late coffee", noticeFromMessage("I like late coffee")?.content)
        assertEquals("RELATIONSHIP", noticeFromMessage("My sister called today")?.type)
    }

    @Test
    fun leavesOrdinaryChatAlone() {
        assertNull(noticeFromMessage("Tell her about your day"))
        assertNull(noticeFromMessage("The demo went well"))
    }

    @Test
    fun importanceReadingUsesPlainLanguage() {
        assertEquals("92 — she'll bring this up unprompted", importanceReading(92))
        assertEquals("60 — she'll use this when it fits", importanceReading(60))
        assertEquals("20 — she keeps this quietly", importanceReading(20))
    }

    @Test
    fun togetherLineCountsWeeks() {
        val created = 1_000_000L
        val fiveWeeksLater = created + 35L * 86_400_000L
        assertEquals("Your girlfriend · 5 weeks together", togetherLine("Girlfriend", created, fiveWeeksLater))
    }

    @Test
    fun highlightPrefersSomethingFromThisWeek() {
        val now = 10_000_000L
        val older = RankedMemory("Your name is Mira", 99, now - 20L * 86_400_000L)
        val recent = RankedMemory("You mentioned your sister", 40, now - 86_400_000L)
        val picked = pickMemoryHighlight(listOf(older, recent), now)
        assertEquals("You mentioned your sister", picked?.content)
        assertEquals(true, picked?.thisWeek)
        assertEquals(
            "She remembered this week: You mentioned your sister",
            highlightLine(picked!!),
        )
        val onlyOld = pickMemoryHighlight(listOf(older), now)
        assertEquals(false, onlyOld?.thisWeek)
        assertEquals("She remembers: Your name is Mira", highlightLine(onlyOld!!))
        assertNull(pickMemoryHighlight(emptyList(), now))
    }
}
