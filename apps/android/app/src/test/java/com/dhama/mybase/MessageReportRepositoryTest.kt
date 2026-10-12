package com.dhama.mybase

import com.dhama.mybase.core.chat.REPORT_FAILED
import com.dhama.mybase.core.chat.REPORT_NOTE_MAX
import com.dhama.mybase.core.chat.REPORT_NOT_FOUND
import com.dhama.mybase.core.chat.REPORT_TRY_LATER
import com.dhama.mybase.core.chat.REPORT_UNAVAILABLE
import com.dhama.mybase.core.chat.ReportMessageBody
import com.dhama.mybase.core.chat.ReportReason
import com.dhama.mybase.core.chat.canOfferReport
import com.dhama.mybase.core.chat.reportMessageBody
import com.dhama.mybase.core.chat.reportUnavailableReason
import com.dhama.mybase.core.data.MessageReportRepository
import com.dhama.mybase.core.data.ReportResult
import com.dhama.mybase.core.network.ReportHttp
import com.dhama.mybase.core.network.ReportHttpOutcome
import com.dhama.mybase.core.network.apiJson
import com.dhama.mybase.core.network.interpretReportResponse
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
    fun bodyMatchesTheBackendContract() {
        assertEquals(
            listOf("HARMFUL", "SEXUAL", "HATE", "INACCURATE", "OTHER"),
            ReportReason.entries.map { it.code },
        )
        val body = reportMessageBody(12, 8, "INACCURATE", "  ")
        assertEquals(ReportMessageBody(12, 8, "INACCURATE", null), body)
        val encoded = apiJson().encodeToString(body!!)
        assertTrue(encoded.contains("\"messageId\":12"))
        assertTrue(encoded.contains("\"conversationId\":8"))
        assertTrue(encoded.contains("\"reason\":\"INACCURATE\""))
        assertFalse(encoded.contains("\"messageId\":\""))
        assertFalse(encoded.contains("note"))

        val noted = reportMessageBody(4, 3, "OTHER", "  too sharp  ")
        assertEquals("too sharp", noted?.note)
        assertEquals(REPORT_NOTE_MAX, reportMessageBody(4, 3, "HATE", "x".repeat(600))?.note?.length)
        assertNull(reportMessageBody(null, 3, "HARMFUL", ""))
        assertNull(reportMessageBody(0, 3, "HARMFUL", ""))
        assertNull(reportMessageBody(4, 0, "HARMFUL", ""))
        assertNull(reportMessageBody(4, null, "HARMFUL", ""))
        assertNull(reportMessageBody(4, 3, "RUDE", ""))
        assertNull(reportMessageBody(4, 3, "harmful", ""))
        assertEquals(REPORT_UNAVAILABLE, reportUnavailableReason(null, 8))
        assertEquals(REPORT_UNAVAILABLE, reportUnavailableReason(0, 8))
        assertNull(reportUnavailableReason(4, 8))
        assertTrue(canOfferReport("ASSISTANT"))
        assertFalse(canOfferReport("USER"))
        assertFalse(canOfferReport("SYSTEM"))
    }

    @Test
    fun created201AndDuplicate200AreBothSuccess() {
        val created = interpretReportResponse(201, envelope(201, 4))
        val duplicate = interpretReportResponse(200, envelope(200, 9))
        assertEquals(ReportHttpOutcome.Accepted(4, created = true), created)
        assertEquals(ReportHttpOutcome.Accepted(9, created = false), duplicate)
        assertEquals(ReportHttpOutcome.Rejected(REPORT_FAILED), interpretReportResponse(201, envelope(201, null)))
    }

    @Test
    fun postsOnceAndIgnoresASecondSubmit() = runBlocking {
        val posted = mutableListOf<ReportMessageBody>()
        val repository = MessageReportRepository { body ->
            posted += body
            created(body.messageId)
        }
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
            created(4)
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
    fun http200DuplicateShowsTheSameSuccessAs201() = runBlocking {
        var posts = 0
        val repository = MessageReportRepository {
            posts += 1
            ReportHttp(200, envelope(200, 9))
        }
        val body = ReportMessageBody(12, 8, "HARMFUL", null)

        assertEquals(ReportResult.Sent, repository.report(body))
        assertTrue(repository.alreadySent(12))
        assertEquals(ReportResult.Duplicate, repository.report(body))
        assertEquals(1, posts)
    }

    @Test
    fun http404IsAnErrorAndDoesNotCountAsSent() = runBlocking {
        var posts = 0
        val repository = MessageReportRepository {
            posts += 1
            if (posts == 1) ReportHttp(404, errorEnvelope(404, "Message not found")) else created(12)
        }
        val body = ReportMessageBody(12, 8, "HATE", null)

        assertEquals(ReportResult.Failed(REPORT_NOT_FOUND), repository.report(body))
        assertFalse(repository.alreadySent(12))
        assertEquals(ReportResult.Sent, repository.report(body))
        assertEquals(2, posts)
    }

    @Test
    fun http429AsksToTryAgainLater() = runBlocking {
        var posts = 0
        val repository = MessageReportRepository {
            posts += 1
            if (posts == 1) ReportHttp(429, errorEnvelope(429, "Too many reports")) else created(12)
        }
        val body = ReportMessageBody(12, 8, "OTHER", null)

        val failed = repository.report(body)
        assertEquals(ReportResult.Failed(REPORT_TRY_LATER), failed)
        assertTrue((failed as ReportResult.Failed).message.contains("try again later", ignoreCase = true))
        assertFalse(repository.alreadySent(12))
        assertEquals(ReportResult.Sent, repository.report(body))
        assertEquals(2, posts)
    }

    @Test
    fun aFailedReportCanBeSentAgain() = runBlocking {
        var attempts = 0
        val repository = MessageReportRepository {
            attempts += 1
            if (attempts == 1) throw IllegalStateException("offline")
            created(4)
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
            created(4)
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

private fun created(id: Int) = ReportHttp(201, envelope(201, id))

private fun envelope(status: Int, id: Int?): String {
    val data = if (id == null) "null" else """{"id":$id}"""
    return """{"success":true,"statusCode":$status,"message":"Request successful","data":$data,"path":"/api/v1/reports"}"""
}

private fun errorEnvelope(status: Int, message: String): String {
    return """{"success":false,"statusCode":$status,"message":"$message","path":"/api/v1/reports"}"""
}
