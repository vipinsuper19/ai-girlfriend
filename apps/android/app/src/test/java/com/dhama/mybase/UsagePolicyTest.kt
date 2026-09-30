package com.dhama.mybase

import com.dhama.mybase.core.usage.CountedMessage
import com.dhama.mybase.core.usage.UsageLevel
import com.dhama.mybase.core.usage.monthUsage
import com.dhama.mybase.core.usage.resetLabel
import com.dhama.mybase.core.usage.usageLevel
import com.dhama.mybase.core.usage.utcMonthReset
import com.dhama.mybase.core.usage.utcMonthStart
import org.junit.Assert.assertEquals
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
}
