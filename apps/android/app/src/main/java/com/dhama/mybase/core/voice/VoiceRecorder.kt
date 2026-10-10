package com.dhama.mybase.core.voice

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import android.os.SystemClock
import java.io.File
import java.util.ArrayDeque
import java.util.UUID

data class RecordedNote(
    val path: String,
    val durationMs: Long,
)

/**
 * AAC in an MPEG-4 file. Amplitude is sampled by the caller every
 * [AMPLITUDE_POLL_MS] so the recording meter reflects the microphone.
 */
class VoiceRecorder(
    private val directory: File,
) {
    private var recorder: MediaRecorder? = null
    private var file: File? = null
    private var startedAt = 0L
    private val samples = ArrayDeque<Float>()

    val isRecording: Boolean
        get() = recorder != null

    fun start(context: Context) {
        cancel()
        directory.mkdirs()
        val target = File(directory, "${UUID.randomUUID()}.m4a")
        val next = newRecorder(context)
        next.setAudioSource(MediaRecorder.AudioSource.MIC)
        next.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        next.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        next.setOutputFile(target.absolutePath)
        next.prepare()
        next.start()
        recorder = next
        file = target
        startedAt = SystemClock.elapsedRealtime()
        samples.clear()
    }

    fun elapsedMs(): Long {
        if (recorder == null) return 0
        return SystemClock.elapsedRealtime() - startedAt
    }

    fun poll(): List<Float> {
        val raw = runCatching { recorder?.maxAmplitude ?: 0 }.getOrDefault(0)
        val level = (raw / MAX_AMPLITUDE).coerceIn(0f, 1f)
        samples.addLast(level)
        while (samples.size > SAMPLE_WINDOW) samples.removeFirst()
        return samples.toList()
    }

    fun stop(): RecordedNote? {
        val target = file
        val elapsed = elapsedMs()
        val active = recorder
        recorder = null
        file = null
        if (active != null) {
            runCatching { active.stop() }
            active.release()
        }
        if (target == null || !target.exists() || target.length() == 0L) {
            target?.delete()
            return null
        }
        return RecordedNote(target.absolutePath, elapsed)
    }

    fun cancel() {
        val active = recorder
        val target = file
        recorder = null
        file = null
        if (active != null) {
            runCatching { active.stop() }
            active.release()
        }
        target?.delete()
        samples.clear()
    }

    private fun newRecorder(context: Context): MediaRecorder {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(context)
        } else {
            @Suppress("DEPRECATION")
            MediaRecorder()
        }
    }

    private companion object {
        const val MAX_AMPLITUDE = 32767f
        const val SAMPLE_WINDOW = 24
    }
}
