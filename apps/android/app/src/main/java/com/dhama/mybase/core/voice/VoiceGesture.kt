package com.dhama.mybase.core.voice

enum class VoiceRelease {
    Send,
    Cancel,
    Lock,
}

/**
 * Hold releases as a send. A short tap locks the recording so it can be stopped
 * without holding. Sliding left cancels. A locked recording ignores the release.
 */
fun voiceReleaseAction(durationMs: Long, slideXDp: Float, locked: Boolean): VoiceRelease {
    if (locked) return VoiceRelease.Lock
    if (slideXDp <= -CANCEL_SLIDE_DP) return VoiceRelease.Cancel
    if (durationMs < TAP_LOCK_MS) return VoiceRelease.Lock
    return VoiceRelease.Send
}

fun formatVoiceDuration(durationMs: Long): String {
    val totalSeconds = (durationMs / 1000).coerceAtLeast(0)
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "%d:%02d".format(minutes, seconds)
}

/** Fixed bars for a saved voice note. Playback audio has no amplitude data. */
fun playbackWaveform(): List<Float> = listOf(
    0.35f, 0.62f, 0.48f, 0.84f, 0.55f, 0.73f, 0.4f, 0.9f, 0.58f, 0.7f, 0.46f, 0.66f,
)

/**
 * Relative `/uploads/...` paths from the voice API are resolved against the
 * server origin. Local files and absolute URLs stay as they are.
 */
fun resolveVoiceUrl(apiOrigin: String, path: String): String {
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("file:")) {
        return path
    }
    if (path.startsWith("/")) return apiOrigin.trimEnd('/') + path
    return path
}

const val CANCEL_SLIDE_DP = 72f
const val TAP_LOCK_MS = 250L
const val AMPLITUDE_POLL_MS = 60L
const val SPEAK_MAX_CHARS = 10_000

enum class VoiceRoundTrip {
    Transcribing,
    Thinking,
    GeneratingVoice,
}

/**
 * Labels for the single `POST /voice/respond` request. The clock only describes
 * the call that is actually in flight. It does not invent a transcript.
 */
fun voiceRoundTripStage(elapsedMs: Long): VoiceRoundTrip {
    return when {
        elapsedMs < 2_500L -> VoiceRoundTrip.Transcribing
        elapsedMs < 5_500L -> VoiceRoundTrip.Thinking
        else -> VoiceRoundTrip.GeneratingVoice
    }
}

fun voiceRoundTripLabel(stage: VoiceRoundTrip): String {
    return when (stage) {
        VoiceRoundTrip.Transcribing -> "Transcribing…"
        VoiceRoundTrip.Thinking -> "Thinking…"
        VoiceRoundTrip.GeneratingVoice -> "Generating her voice…"
    }
}

/** Speak is for a finished text reply. Voice notes already have their own play control. */
fun canSpeakMessage(role: String, kind: String, delivery: String, text: String): Boolean {
    return role != "USER" && kind == "TEXT" && delivery == "SENT" && text.isNotBlank()
}

/**
 * Null means the text can be sent to `POST /voice/synthesize`. A reason is shown
 * on the message instead of calling the server or inventing speech on the phone.
 */
fun speakBlockReason(text: String, companionServerId: Int?): String? {
    val body = text.trim()
    if (body.isEmpty()) return "There's nothing to speak."
    if (body.length > SPEAK_MAX_CHARS) return "That reply is too long to speak."
    if (companionServerId == null) return "Sign in with email to hear her voice."
    return null
}

fun speakFailure(status: Int, code: String? = null, message: String = ""): String {
    if (code == "USAGE_LIMIT_EXCEEDED") {
        return if ("VOICE_MINUTES" in message) {
            "You've used your voice minutes for this month."
        } else {
            "You've used your messages for this month."
        }
    }
    return when (status) {
        401 -> "Sign in with email to hear her voice."
        404 -> "Her voice isn't set up yet."
        else -> "Couldn't speak that."
    }
}
