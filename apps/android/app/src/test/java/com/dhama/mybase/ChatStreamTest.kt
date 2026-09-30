package com.dhama.mybase

import com.dhama.mybase.core.chat.ChatStreamEvent
import com.dhama.mybase.core.chat.personalityUpdatedLine
import com.dhama.mybase.core.chat.chunkReply
import com.dhama.mybase.core.chat.consumeSse
import com.dhama.mybase.core.chat.localReply
import org.junit.Assert.assertEquals
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
    fun personalityUpdateIsACentredMarker() {
        assertEquals("Aria's personality was updated", personalityUpdatedLine("Aria"))
        assertEquals("Nova's personality was updated", personalityUpdatedLine("  Nova  "))
        assertEquals("Her personality was updated", personalityUpdatedLine("   "))
    }
}
