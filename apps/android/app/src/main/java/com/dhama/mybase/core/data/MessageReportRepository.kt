package com.dhama.mybase.core.data

import com.dhama.mybase.core.chat.REPORT_FAILED
import com.dhama.mybase.core.chat.ReportMessageBody
import com.dhama.mybase.core.network.ReportHttp
import com.dhama.mybase.core.network.ReportHttpOutcome
import com.dhama.mybase.core.network.interpretReportResponse
import kotlin.coroutines.cancellation.CancellationException

sealed class ReportResult {
    data object Sent : ReportResult()
    data object Duplicate : ReportResult()
    data class Failed(val message: String) : ReportResult()
}

/**
 * Sends one report per server message. A second submit while the first is in flight,
 * or after it succeeded, does not call the backend again. A failure can be retried.
 *
 * 201 and 200 both count as success. 404 and 429 do not.
 */
class MessageReportRepository(
    private val post: suspend (ReportMessageBody) -> ReportHttp,
) {
    private val lock = Any()
    private val sentIds = mutableSetOf<Int>()
    private val inFlight = mutableSetOf<Int>()

    fun alreadySent(messageId: Int): Boolean {
        synchronized(lock) {
            return messageId in sentIds
        }
    }

    private fun markSent(messageId: Int) {
        synchronized(lock) { sentIds += messageId }
    }

    suspend fun report(body: ReportMessageBody): ReportResult {
        synchronized(lock) {
            if (body.messageId in sentIds || body.messageId in inFlight) {
                return ReportResult.Duplicate
            }
            inFlight += body.messageId
        }
        return try {
            val http = post(body)
            when (val outcome = interpretReportResponse(http.status, http.body)) {
                is ReportHttpOutcome.Accepted -> {
                    markSent(body.messageId)
                    ReportResult.Sent
                }
                is ReportHttpOutcome.Rejected -> ReportResult.Failed(outcome.message)
            }
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            ReportResult.Failed(error.message?.takeIf { it.isNotBlank() } ?: REPORT_FAILED)
        } finally {
            synchronized(lock) { inFlight -= body.messageId }
        }
    }
}
