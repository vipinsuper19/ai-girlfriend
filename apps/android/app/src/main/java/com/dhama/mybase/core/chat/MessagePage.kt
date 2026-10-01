package com.dhama.mybase.core.chat

const val MESSAGE_PAGE = 40

/** Oldest server id to request, once a full page is already on the phone. */
fun olderMessageCursor(serverIds: List<Int>, pageSize: Int = MESSAGE_PAGE): Int? {
    if (serverIds.size < pageSize) return null
    return serverIds.minOrNull()
}

/** Load another page only after the reader has moved, then come back to the top. */
fun shouldLoadOlder(
    hasOlder: Boolean,
    loading: Boolean,
    hasScrolled: Boolean,
    firstVisibleIndex: Int,
): Boolean {
    return hasOlder && !loading && hasScrolled && firstVisibleIndex == 0
}

fun messageListQuery(before: Int?, limit: Int?): String {
    val parts = buildList {
        if (before != null) add("before=$before")
        if (limit != null) add("limit=$limit")
    }
    return if (parts.isEmpty()) "" else parts.joinToString("&", prefix = "?")
}
