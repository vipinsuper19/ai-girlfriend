package com.dhama.mybase.core.network

import com.dhama.mybase.core.chat.REPORT_FAILED
import com.dhama.mybase.core.chat.REPORT_NOT_FOUND
import com.dhama.mybase.core.chat.REPORT_TRY_LATER
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** Status and raw body from `POST /reports`, including error responses. */
data class ReportHttp(val status: Int, val body: String)

sealed class ReportHttpOutcome {
    data class Accepted(val id: Int, val created: Boolean) : ReportHttpOutcome()
    data class Rejected(val message: String) : ReportHttpOutcome()
}

/**
 * Maps the live `POST /reports` contract.
 * 201 `{ id }` is a new report. 200 `{ id }` is a duplicate and is also success.
 * 404 and 429 keep their own messages. Every other failure uses the generic report error.
 */
fun interpretReportResponse(status: Int, body: String, json: Json = apiJson()): ReportHttpOutcome {
    return when (status) {
        404 -> ReportHttpOutcome.Rejected(REPORT_NOT_FOUND)
        429 -> ReportHttpOutcome.Rejected(REPORT_TRY_LATER)
        200, 201 -> {
            val id = runCatching { unwrapData<ReportIdPayload>(body, json).id }.getOrNull()
            if (id != null && id >= 1) {
                ReportHttpOutcome.Accepted(id, created = status == 201)
            } else {
                ReportHttpOutcome.Rejected(REPORT_FAILED)
            }
        }
        else -> ReportHttpOutcome.Rejected(REPORT_FAILED)
    }
}

@Serializable
private data class ReportIdPayload(val id: Int = 0)
