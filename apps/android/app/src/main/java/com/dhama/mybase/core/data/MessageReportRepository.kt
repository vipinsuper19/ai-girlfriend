package com.dhama.mybase.core.data

import com.dhama.mybase.core.chat.ReportMessageBody
import com.dhama.mybase.core.network.ApiStatusException
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
 * HTTP 409 means the server already stored this report, so it counts as success.
 * HTTP 404 is an error and does not count as sent.
 */
class MessageReportRepository(
    private val post: suspend (ReportMessageBody) -> Unit,
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
            post(body)
            markSent(body.messageId)
            ReportResult.Sent
        } catch (error: CancellationException) {
            throw error
        } catch (error: ApiStatusException) {
            if (error.status == 409) {
                markSent(body.messageId)
                ReportResult.Sent
            } else {
                ReportResult.Failed(reportFailureMessage(error))
            }
        } catch (error: Exception) {
            ReportResult.Failed(reportFailureMessage(error))
        } finally {
            synchronized(lock) { inFlight -= body.messageId }
        }
    }
}

private fun reportFailureMessage(error: Exception): String {
    val fallback = if (error is ApiStatusException && error.status == 404) {
        "That reply couldn't be found."
    } else {
        "Couldn't send that report."
    }
    val message = error.message?.takeIf { it.isNotBlank() && it != "Request failed" }
    return message ?: fallback
}
