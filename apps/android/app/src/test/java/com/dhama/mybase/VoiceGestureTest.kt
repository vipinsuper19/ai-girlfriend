package com.dhama.mybase

import com.dhama.mybase.core.voice.VoiceRelease
import com.dhama.mybase.core.voice.formatVoiceDuration
import com.dhama.mybase.core.voice.playbackWaveform
import com.dhama.mybase.core.voice.resolveVoiceUrl
import com.dhama.mybase.core.voice.voiceReleaseAction
import org.junit.Assert.assertEquals
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
}
