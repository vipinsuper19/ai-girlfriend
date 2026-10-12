package com.dhama.mybase

import com.dhama.mybase.core.chat.REPORT_NOTE_MAX
import com.dhama.mybase.core.chat.REPORT_UNAVAILABLE
import com.dhama.mybase.core.chat.ReportMessageBody
import com.dhama.mybase.core.chat.reportMessageBody
import com.dhama.mybase.core.chat.reportUnavailableReason
import com.dhama.mybase.core.data.MessageReportRepository
import com.dhama.mybase.core.data.ReportResult
import com.dhama.mybase.core.network.apiJson
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.encodeToString
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.coroutines.cancellation.CancellationException

class MessageReportRepositoryTest {

    @Test
    fun buildsTheInferredReportBodyAndOmitsABlankNote() {
        val body = reportMessageBody(12, 8, "INACCURATE", "  ")
        assertEquals(ReportMessageBody(12, 8, "INACCURATE", null), body)
        val encoded = apiJson().encodeToString(body!!)
        assertTrue(encoded.contains("\"messageId\":12"))
        assertTrue(encoded.contains("\"conversationId\":8"))
        assertTrue(encoded.contains("\"reason\":\"INACCURATE\""))
        assertFalse(encoded.contains("note"))
    }

    @Test
    fun keepsANoteAndDropsLocalOrUnknownReports() {
        val noted = reportMessageBody(4, 3, "OTHER", "  too sharp  ")
        assertEquals("too sharp", noted?.note)
        assertEquals(REPORT_NOTE_MAX, reportMessageBody(4, 3, "HATE", "x".repeat(600))?.note?.length)
        assertNull(reportMessageBody(null, 3, "HARMFUL", ""))
        assertNull(reportMessageBody(4, null, "HARMFUL", ""))
        assertNull(reportMessageBody(4, 3, "RUDE", ""))
        assertEquals(REPORT_UNAVAILABLE, reportUnavailableReason(null, 8))
        assertNull(reportUnavailableReason(4, 8))
    }

    @Test
    fun postsOnceAndIgnoresASecondSubmit() = runBlocking {
        val posted = mutableListOf<ReportMessageBody>()
        val repository = MessageReportRepository { posted += it }
        val body = ReportMessageBody(messageId = 12, conversationId = 8, reason = "HARMFUL", note = "unsafe")

        val other = body.copy(messageId = 13, reason = "SEXUAL")
        assertEquals(ReportResult.Sent, repository.report(body))
        assertEquals(ReportResult.Duplicate, repository.report(body))
        assertEquals(ReportResult.Sent, repository.report(other))
        assertEquals(listOf(body, other), posted)
        assertTrue(repository.alreadySent(12))
    }

    @Test
    fun aSecondSubmitWhileTheFirstIsInFlightDoesNotPost() = runBlocking {
        val entered = CompletableDeferred<Unit>()
        val release = CompletableDeferred<Unit>()
        var posts = 0
        val repository = MessageReportRepository {
            posts += 1
            entered.complete(Unit)
            release.await()
        }
        val body = ReportMessageBody(4, 8, "HATE", null)
        val first = async { repository.report(body) }
        entered.await()
        assertEquals(ReportResult.Duplicate, repository.report(body))
        release.complete(Unit)
        assertEquals(ReportResult.Sent, first.await())
        assertEquals(1, posts)
    }

    @Test
    fun aFailedReportCanBeSentAgain() = runBlocking {
        var attempts = 0
        val repository = MessageReportRepository {
            attempts += 1
            if (attempts == 1) throw IllegalStateException("offline")
        }
        val body = ReportMessageBody(4, 8, "OTHER", "spam")
        assertEquals(ReportResult.Failed("offline"), repository.report(body))
        assertEquals(ReportResult.Sent, repository.report(body))
        assertEquals(2, attempts)
        assertFalse(repository.alreadySent(9))
    }

    @Test
    fun cancellationDoesNotCountAsSent() = runBlocking {
        var attempts = 0
        val repository = MessageReportRepository {
            attempts += 1
            if (attempts == 1) throw CancellationException("stopped")
        }
        val body = ReportMessageBody(4, 8, "SEXUAL", null)
        try {
            repository.report(body)
            throw AssertionError("expected cancellation")
        } catch (error: CancellationException) {
            assertEquals("stopped", error.message)
        }
        assertEquals(ReportResult.Sent, repository.report(body))
        assertEquals(2, attempts)
    }
}
