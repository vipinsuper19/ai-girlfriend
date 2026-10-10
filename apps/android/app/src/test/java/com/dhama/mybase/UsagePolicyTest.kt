package com.dhama.mybase

import com.dhama.mybase.core.usage.CountedMessage
import com.dhama.mybase.core.usage.PlanUsage
import com.dhama.mybase.core.usage.UsageLevel
import com.dhama.mybase.core.usage.messageAllowanceClosed
import com.dhama.mybase.core.usage.monthUsage
import com.dhama.mybase.core.usage.phonePlanUsage
import com.dhama.mybase.core.usage.planCaption
import com.dhama.mybase.core.usage.resetLabel
import com.dhama.mybase.core.usage.showMessageWall
import com.dhama.mybase.core.usage.usageLevel
import com.dhama.mybase.core.usage.usageLimitBlocksMessages
import com.dhama.mybase.core.usage.usageLimitNotice
import com.dhama.mybase.core.usage.utcMonthReset
import com.dhama.mybase.core.usage.utcMonthStart
import com.dhama.mybase.core.usage.voiceAllowanceClosed
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UsagePolicyTest {

    @Test
    fun periodIsTheUtcCalendarMonth() {
        val march = 1_741_000_000_000L
        val start = utcMonthStart(march)
        val reset = utcMonthReset(march)
        assertEquals("1 Mar", resetLabel(start))
        assertEquals("1 Apr", resetLabel(reset))
        assertEquals(reset, utcMonthStart(reset))
    }

    @Test
    fun eightyPercentWarnsAndTheLimitWalls() {
        assertEquals(UsageLevel.OK, usageLevel(79, 100))
        assertEquals(UsageLevel.NEARING, usageLevel(80, 100))
        assertEquals(UsageLevel.WALL, usageLevel(100, 100))
        assertEquals(UsageLevel.OK, usageLevel(500, null))
    }

    @Test
    fun countsUserMessagesAndVoiceMinutesInThePeriod() {
        val now = 1_741_000_000_000L
        val start = utcMonthStart(now)
        val usage = monthUsage(
            listOf(
                CountedMessage("USER", start + 1_000, 0),
                CountedMessage("USER", start + 2_000, 61_000),
                CountedMessage("ASSISTANT", start + 3_000, 0),
                CountedMessage("USER", start - 1_000, 0),
            ),
            now,
        )
        assertEquals(2, usage.messages)
        assertEquals(2, usage.voiceMinutes)
    }

    @Test
    fun serverLimitsCloseTheActionTheyName() {
        val open = PlanUsage(12, 100, 1, 10, 0, 5, 1L, 2L, fromServer = true)
        val full = open.copy(messagesUsed = 100)
        val unlimited = open.copy(messagesLimit = null, messagesUsed = 500)
        assertFalse(messageAllowanceClosed(open))
        assertTrue(messageAllowanceClosed(full))
        assertFalse(messageAllowanceClosed(unlimited))
        assertTrue(showMessageWall(open, blocked = true))
        assertFalse(showMessageWall(null, blocked = false))
        assertTrue(voiceAllowanceClosed(open.copy(voiceUsed = 10)))
        assertFalse(voiceAllowanceClosed(open.copy(voiceLimit = null, voiceUsed = 40)))
        assertEquals("This month on your plan.", planCaption(true))
        assertEquals("This month on this phone.", planCaption(false))
        assertEquals(1, phonePlanUsage(monthUsage(listOf(CountedMessage("USER", utcMonthStart(now()) + 1, 0)), now())).messagesUsed)
        assertEquals(
            "You've used your voice minutes for this month.",
            usageLimitNotice("Usage limit exceeded for VOICE_MINUTES"),
        )
        assertEquals(
            "You've used your messages for this month.",
            usageLimitNotice("Usage limit exceeded for MESSAGES"),
        )
        assertFalse(usageLimitBlocksMessages("Usage limit exceeded for VOICE_MINUTES"))
        assertTrue(usageLimitBlocksMessages("Usage limit exceeded for MESSAGES"))
    }

    private fun now(): Long = 1_741_000_000_000L
}
