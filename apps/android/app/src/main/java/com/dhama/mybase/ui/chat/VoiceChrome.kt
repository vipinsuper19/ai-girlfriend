package com.dhama.mybase.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.dhama.mybase.core.voice.formatVoiceDuration
import com.dhama.mybase.core.voice.playbackWaveform

@Composable
fun HoldMic(
    enabled: Boolean,
    recording: Boolean,
    onDown: () -> Unit,
    onDragDp: (Float) -> Unit,
    onUp: (Float) -> Unit,
) {
    val density = LocalDensity.current
    val downAction = rememberUpdatedState(onDown)
    val dragAction = rememberUpdatedState(onDragDp)
    val upAction = rememberUpdatedState(onUp)
    Box(
        Modifier
            .size(48.dp)
            .pointerInput(enabled) {
                if (!enabled) return@pointerInput
                awaitEachGesture {
                    val down = awaitFirstDown()
                    downAction.value()
                    var dx = 0f
                    while (true) {
                        val event = awaitPointerEvent()
                        val change = event.changes.firstOrNull { it.id == down.id } ?: break
                        if (!change.pressed) break
                        dx = change.position.x - down.position.x
                        dragAction.value(with(density) { dx.toDp().value })
                        change.consume()
                    }
                    upAction.value(with(density) { dx.toDp().value })
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            Icons.Default.Mic,
            contentDescription = "Hold to record. Tap to lock.",
            tint = if (recording) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
fun RecordingMeter(
    amplitudes: List<Float>,
    elapsedMs: Long,
    cancelling: Boolean,
    locked: Boolean,
    modifier: Modifier = Modifier,
) {
    val spoken = formatVoiceDuration((elapsedMs / 5_000L) * 5_000L)
    Column(modifier) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                formatVoiceDuration(elapsedMs),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.clearAndSetSemantics {
                    liveRegion = LiveRegionMode.Polite
                    contentDescription = "Recording $spoken"
                },
            )
            AmplitudeBars(
                levels = amplitudes.ifEmpty { listOf(0.15f) },
                color = if (cancelling) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 12.dp),
            )
        }
        Text(
            when {
                cancelling -> "Release to cancel"
                locked -> "Locked. Send or cancel."
                else -> "Slide to cancel"
            },
            style = MaterialTheme.typography.bodySmall,
            color = if (cancelling) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
fun VoiceNoteContent(
    text: String,
    durationMs: Long,
    playing: Boolean,
    color: Color,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onToggle, modifier = Modifier.size(48.dp)) {
                Icon(
                    if (playing) Icons.Default.Pause else Icons.Default.PlayArrow,
                    contentDescription = if (playing) "Pause voice note" else "Play voice note",
                    tint = color,
                )
            }
            AmplitudeBars(
                levels = playbackWaveform(),
                color = color,
                modifier = Modifier
                    .weight(1f)
                    .padding(end = 8.dp),
            )
            Text(formatVoiceDuration(durationMs), color = color, style = MaterialTheme.typography.labelMedium)
        }
        if (text.isNotBlank()) {
            Text(
                "Transcribed from your voice note",
                color = color.copy(alpha = 0.8f),
                style = MaterialTheme.typography.labelSmall,
                modifier = Modifier.padding(start = 12.dp, end = 12.dp),
            )
            Text(
                text,
                color = color,
                modifier = Modifier.padding(start = 12.dp, end = 12.dp, bottom = 8.dp),
            )
        }
    }
}

@Composable
fun ImageNote(path: String) {
    if (path.isBlank()) return
    AsyncImage(
        model = path,
        contentDescription = "Photo",
        contentScale = ContentScale.Crop,
        modifier = Modifier
            .fillMaxWidth(0.7f)
            .heightIn(max = 240.dp)
            .clip(RoundedCornerShape(20.dp)),
    )
}

@Composable
private fun AmplitudeBars(
    levels: List<Float>,
    color: Color,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier.height(28.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        levels.forEach { level ->
            Box(
                Modifier
                    .width(3.dp)
                    .height((6 + (22 * level.coerceIn(0f, 1f))).dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(color),
            )
        }
    }
}
