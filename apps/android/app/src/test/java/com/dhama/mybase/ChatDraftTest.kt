package com.dhama.mybase

import com.dhama.mybase.core.chat.CHAT_MESSAGE_MAX_CHARS
import com.dhama.mybase.core.chat.chatDraftLimitNote
import com.dhama.mybase.core.chat.chatDraftOverLimit
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatDraftTest {

    @Test
    fun staysQuietUntilTheDraftIsNearTheLimit() {
        assertNull(chatDraftLimitNote("a".repeat(6499)))
        assertFalse(chatDraftOverLimit("a".repeat(6499)))
        assertEquals("6500 / 7000", chatDraftLimitNote("a".repeat(6500)))
        assertFalse(chatDraftOverLimit("a".repeat(6500)))
    }

    @Test
    fun theLimitItselfCanStillBeSent() {
        val full = "a".repeat(CHAT_MESSAGE_MAX_CHARS)
        assertEquals("7000 / 7000. That's the limit.", chatDraftLimitNote(full))
        assertFalse(chatDraftOverLimit(full))
    }

    @Test
    fun pastedTextOverTheLimitStaysAndCannotBeSent() {
        val pasted = "hello ".repeat(2000)
        assertTrue(pasted.length > CHAT_MESSAGE_MAX_CHARS)
        assertTrue(chatDraftOverLimit(pasted))
        assertEquals("${pasted.length} / 7000. Shorten it to send.", chatDraftLimitNote(pasted))
    }
}