package com.dhama.mybase

import com.dhama.mybase.core.voice.SPEAK_MAX_CHARS
import com.dhama.mybase.core.voice.VoiceRelease
import com.dhama.mybase.core.voice.canSpeakMessage
import com.dhama.mybase.core.voice.formatVoiceDuration
import com.dhama.mybase.core.voice.playbackWaveform
import com.dhama.mybase.core.voice.resolveVoiceUrl
import com.dhama.mybase.core.voice.VoiceRoundTrip
import com.dhama.mybase.core.voice.speakBlockReason
import com.dhama.mybase.core.voice.speakFailure
import com.dhama.mybase.core.voice.voiceReleaseAction
import com.dhama.mybase.core.voice.voiceRoundTripLabel
import com.dhama.mybase.core.voice.voiceRoundTripStage
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class VoiceGestureTest {

    @Test
    fun holdSendsShortTapLocksAndSlideCancels() {
        assertEquals(VoiceRelease.Send, voiceReleaseAction(800, 0f, locked = false))
        assertEquals(VoiceRelease.Lock, voiceReleaseAction(120, 0f, locked = false))
        assertEquals(VoiceRelease.Cancel, voiceReleaseAction(800, -80f, locked = false))
        assertEquals(VoiceRelease.Lock, voiceReleaseAction(800, -80f, locked = true))
    }

    @Test
    fun durationFormatsAsMinutesAndSeconds() {
        assertEquals("0:00", formatVoiceDuration(0))
        assertEquals("0:04", formatVoiceDuration(4_200))
        assertEquals("1:05", formatVoiceDuration(65_000))
    }

    @Test
    fun playbackWaveformIsAFixedPattern() {
        assertEquals(playbackWaveform(), playbackWaveform())
        assertEquals(12, playbackWaveform().size)
    }

    @Test
    fun relativeUploadPathsJoinTheServerOrigin() {
        assertEquals(
            "https://api.example/uploads/voice/note.wav",
            resolveVoiceUrl("https://api.example/", "/uploads/voice/note.wav"),
        )
        assertEquals("file:///tmp/note.m4a", resolveVoiceUrl("https://api.example", "file:///tmp/note.m4a"))
    }

    @Test
    fun speakIsOnlyForAFinishedTextReply() {
        assertEquals(true, canSpeakMessage("ASSISTANT", "TEXT", "SENT", "Hello"))
        assertEquals(false, canSpeakMessage("USER", "TEXT", "SENT", "Hello"))
        assertEquals(false, canSpeakMessage("ASSISTANT", "AUDIO", "SENT", "Hello"))
        assertEquals(false, canSpeakMessage("ASSISTANT", "TEXT", "STREAMING", "Hello"))
        assertEquals(false, canSpeakMessage("ASSISTANT", "TEXT", "SENT", "  "))
    }

    @Test
    fun speakStaysOnTheServer() {
        assertNull(speakBlockReason("Hello", 4))
        assertEquals("There's nothing to speak.", speakBlockReason("  ", 4))
        assertEquals(
            "That reply is too long to speak.",
            speakBlockReason("a".repeat(SPEAK_MAX_CHARS + 1), 4),
        )
        assertNull(speakBlockReason("a".repeat(SPEAK_MAX_CHARS), 4))
        assertEquals("Sign in with email to hear her voice.", speakBlockReason("Hello", null))
        assertEquals("Her voice isn't set up yet.", speakFailure(404))
        assertEquals("Couldn't speak that.", speakFailure(500))
    }

    @Test
    fun voiceRoundTripNamesTheLiveRequest() {
        assertEquals(VoiceRoundTrip.Transcribing, voiceRoundTripStage(0))
        assertEquals(VoiceRoundTrip.Thinking, voiceRoundTripStage(2_500))
        assertEquals(VoiceRoundTrip.GeneratingVoice, voiceRoundTripStage(5_500))
        assertEquals("Transcribing…", voiceRoundTripLabel(VoiceRoundTrip.Transcribing))
        assertEquals("Generating her voice…", voiceRoundTripLabel(VoiceRoundTrip.GeneratingVoice))
    }
}
