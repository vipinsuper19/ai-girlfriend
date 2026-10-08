package com.dhama.mybase.core.home

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Time-of-day line. The name comes from GET /users/me. */
fun homeGreeting(hourOfDay: Int, displayName: String): String {
    val hello = when {
        hourOfDay < 12 -> "Good morning"
        hourOfDay < 17 -> "Good afternoon"
        else -> "Good evening"
    }
    val name = displayName.trim()
    return if (name.isEmpty()) hello else "$hello, $name"
}

/** "Active now" only when this phone is on her server conversation. */
fun presenceLine(linkedToServer: Boolean): String {
    return if (linkedToServer) "Active now" else "On this phone"
}

/** Exact clock time for a long-press. Gap stamps stay short; this one is complete. */
fun exactMessageTime(epochMs: Long, zone: ZoneId = ZoneId.of("UTC")): String {
    val time = Instant.ofEpochMilli(epochMs).atZone(zone)
    return time.format(DateTimeFormatter.ofPattern("EEE, MMM d, yyyy · h:mm a", Locale.US))
}
