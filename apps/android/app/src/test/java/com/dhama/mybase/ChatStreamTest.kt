package com.dhama.mybase

import com.dhama.mybase.core.chat.ChatStreamEvent
import com.dhama.mybase.core.chat.StreamRecovery
import com.dhama.mybase.core.chat.chatStatusLine
import com.dhama.mybase.core.chat.chunkReply
import com.dhama.mybase.core.chat.consumeSse
import com.dhama.mybase.core.chat.droppedStreamLine
import com.dhama.mybase.core.chat.endsWithUserMessage
import com.dhama.mybase.core.chat.idleStallDelivery
import com.dhama.mybase.core.chat.MESSAGE_PAGE
import com.dhama.mybase.core.chat.keptOnReload
import com.dhama.mybase.core.chat.messageListQuery
import com.dhama.mybase.core.chat.olderMessageCursor
import com.dhama.mybase.core.chat.shouldLoadOlder
import com.dhama.mybase.core.chat.localReply
import com.dhama.mybase.core.chat.personalityUpdatedLine
import com.dhama.mybase.core.chat.replyFailureDelivery
import com.dhama.mybase.core.chat.retryCaption
import com.dhama.mybase.core.chat.retriesByReload
import com.dhama.mybase.core.chat.streamRecovery
import com.dhama.mybase.core.network.WAKING_SERVER
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatStreamTest {

    @Test
    fun parsesDeltaThenDoneAndKeepsPartialTail() {
        val raw = """
            event: delta
            data: {"type":"delta","content":"Hey"}

            event: done
            data: {"type":"done","message":{"content":"Hey there"}}

            event: delta
            data: {"type":"delta","content":"still
        """.trimIndent() + "\n"

        val (events, rest) = consumeSse(raw)
        assertEquals(ChatStreamEvent.Delta("Hey"), events[0])
        assertEquals(ChatStreamEvent.Done("Hey there"), events[1])
        assertEquals(2, events.size)
        assertTrue(rest.contains("still"))
    }

    @Test
    fun ignoresKeepaliveCommentsBetweenEvents() {
        val raw = "event: delta\ndata: {\"type\":\"delta\",\"content\":\"Hi\"}\n\n: ping\n\nevent: done\ndata: {\"type\":\"done\",\"message\":{\"content\":\"Hi\"}}\n\n"
        val (events, rest) = consumeSse(raw)
        assertEquals(
            listOf(ChatStreamEvent.Delta("Hi"), ChatStreamEvent.Done("Hi")),
            events,
        )
        assertEquals("", rest)
    }

    @Test
    fun doneCarriesTheAssistantMessageAndIgnoresSafety() {
        val raw = "event: done\ndata: {\"type\":\"done\",\"message\":{\"id\":2,\"content\":\"Hi\"},\"safety\":{\"code\":\"content_policy\",\"message\":\"no\"}}\n\n"
        val (events, _) = consumeSse(raw)
        assertEquals(listOf(ChatStreamEvent.Done("Hi", serverMessageId = 2)), events)
    }

    @Test
    fun streamErrorKeepsTheUsageLimitCode() {
        val raw = "event: error\ndata: {\"message\":\"Usage limit exceeded for MESSAGES\",\"code\":\"USAGE_LIMIT_EXCEEDED\"}\n\n"
        val (events, _) = consumeSse(raw)
        assertEquals(
            listOf(ChatStreamEvent.Error("Usage limit exceeded for MESSAGES", "USAGE_LIMIT_EXCEEDED")),
            events,
        )
    }

    @Test
    fun parsesErrorWhenMessageIsAString() {
        val raw = "event: error\ndata: {\"message\":\"The model stalled\"}\n\n"
        val (events, rest) = consumeSse(raw)
        assertEquals(listOf(ChatStreamEvent.Error("The model stalled")), events)
        assertEquals("", rest)
    }

    @Test
    fun localReplyChunksRebuildTheFullText() {
        val reply = localReply("Aria", "Girlfriend", listOf("Caring"), "The demo went well")
        val chunks = chunkReply(reply)
        assertEquals(reply, chunks.joinToString(""))
        assertTrue(reply.contains("Aria"))
        assertTrue(reply.contains("The demo went well"))
    }

    @Test
    fun aDroppedStreamFallsBackOnlyBeforeTheServerAcceptsTheLine() {
        assertEquals(StreamRecovery.Finished, streamRecovery(userAccepted = true, replyStarted = true, finished = true))
        assertEquals(StreamRecovery.Fallback, streamRecovery(userAccepted = false, replyStarted = false, finished = false))
        assertEquals(StreamRecovery.Failed, streamRecovery(userAccepted = true, replyStarted = false, finished = false))
        assertEquals(StreamRecovery.Failed, streamRecovery(userAccepted = true, replyStarted = true, finished = false))
        assertEquals(
            "The live connection dropped, so this reply arrived all at once.",
            droppedStreamLine(),
        )
        assertEquals("FAILED", replyFailureDelivery(userAccepted = false, replyStarted = false, finished = false))
        assertEquals("DROPPED", replyFailureDelivery(userAccepted = true, replyStarted = false, finished = false))
        assertEquals("DROPPED", replyFailureDelivery(userAccepted = true, replyStarted = true, finished = false))
        assertEquals("FAILED", replyFailureDelivery(userAccepted = true, replyStarted = true, finished = true))
    }

    @Test
    fun retryAfterAcceptanceReloadsTheThread() {
        assertTrue(retriesByReload("DROPPED"))
        assertFalse(retriesByReload("FAILED"))
        assertEquals("Reply didn't finish · Retry", retryCaption("DROPPED"))
        assertEquals("Not sent · Retry", retryCaption("FAILED"))
        assertEquals("FAILED", idleStallDelivery(userAccepted = false, replyStarted = false))
        assertEquals("Not sent · Retry", retryCaption(idleStallDelivery(userAccepted = false, replyStarted = false)))
        assertEquals("DROPPED", idleStallDelivery(userAccepted = true, replyStarted = false))
        assertEquals("Reply didn't finish · Retry", retryCaption(idleStallDelivery(userAccepted = true, replyStarted = true)))
        assertTrue(keptOnReload("FAILED", "TEXT"))
        assertTrue(keptOnReload("SENT", "SYSTEM"))
        assertFalse(keptOnReload("DROPPED", "TEXT"))
        assertFalse(keptOnReload("SENT", "TEXT"))
        assertTrue(endsWithUserMessage(listOf("USER"), listOf("TEXT")))
        assertFalse(endsWithUserMessage(listOf("USER", "ASSISTANT"), listOf("TEXT", "TEXT")))
        assertTrue(endsWithUserMessage(listOf("USER", "SYSTEM"), listOf("TEXT", "SYSTEM")))
        assertFalse(endsWithUserMessage(emptyList(), emptyList()))
    }

    @Test
    fun slowFirstByteReplacesTyping() {
        assertEquals(
            WAKING_SERVER,
            chatStatusLine(
                recording = false,
                waking = WAKING_SERVER,
                voiceStage = null,
                streaming = true,
                onServer = true,
            ),
        )
        assertEquals(
            "Typing…",
            chatStatusLine(
                recording = false,
                waking = null,
                voiceStage = null,
                streaming = true,
                onServer = true,
            ),
        )
    }

    @Test
    fun personalityUpdateIsACentredMarker() {
        assertEquals("Aria's personality was updated", personalityUpdatedLine("Aria"))
        assertEquals("Nova's personality was updated", personalityUpdatedLine("  Nova  "))
        assertEquals("Her personality was updated", personalityUpdatedLine("   "))
    }

    @Test
    fun olderPageUsesTheSmallestIdAfterAFullPage() {
        assertEquals(null, olderMessageCursor(listOf(8, 3, 5)))
        val full = (10..10 + MESSAGE_PAGE).toList()
        assertEquals(10, olderMessageCursor(full))
        assertEquals("?limit=40", messageListQuery(null, MESSAGE_PAGE))
        assertEquals("?before=10&limit=40", messageListQuery(10, MESSAGE_PAGE))
        assertEquals("", messageListQuery(null, null))
        assertFalse(shouldLoadOlder(hasOlder = true, loading = false, hasScrolled = false, firstVisibleIndex = 0))
        assertTrue(shouldLoadOlder(hasOlder = true, loading = false, hasScrolled = true, firstVisibleIndex = 0))
        assertFalse(shouldLoadOlder(hasOlder = true, loading = true, hasScrolled = true, firstVisibleIndex = 0))
        assertFalse(shouldLoadOlder(hasOlder = false, loading = false, hasScrolled = true, firstVisibleIndex = 0))
        assertFalse(shouldLoadOlder(hasOlder = true, loading = false, hasScrolled = true, firstVisibleIndex = 2))
    }
}
