package com.dhama.mybase.core.data

import com.dhama.mybase.core.chat.ReportMessageBody
import kotlin.coroutines.cancellation.CancellationException

sealed class ReportResult {
    data object Sent : ReportResult()
    data object Duplicate : ReportResult()
    data class Failed(val message: String) : ReportResult()
}

/**
 * Sends one report per server message. A second submit while the first is in flight,
 * or after it succeeded, does not call the backend again. A failure can be retried.
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

    suspend fun report(body: ReportMessageBody): ReportResult {
        synchronized(lock) {
            if (body.messageId in sentIds || body.messageId in inFlight) {
                return ReportResult.Duplicate
            }
            inFlight += body.messageId
        }
        return try {
            post(body)
            synchronized(lock) { sentIds += body.messageId }
            ReportResult.Sent
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            ReportResult.Failed(error.message?.takeIf { it.isNotBlank() } ?: "Couldn't send that report.")
        } finally {
            synchronized(lock) { inFlight -= body.messageId }
        }
    }
}
