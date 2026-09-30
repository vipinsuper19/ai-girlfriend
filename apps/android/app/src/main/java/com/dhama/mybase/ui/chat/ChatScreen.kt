package com.dhama.mybase.ui.chat

import android.Manifest
import android.content.ClipData
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.dhama.mybase.ui.companion.CompanionPortrait
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.dhama.mybase.core.data.ChatRepositoryImpl
import com.dhama.mybase.core.db.entity.ChatMessageEntity
import com.dhama.mybase.core.usage.CountedMessage
import com.dhama.mybase.core.usage.FREE_MESSAGE_LIMIT
import com.dhama.mybase.core.usage.METERING_ENFORCED
import com.dhama.mybase.core.usage.UsageLevel
import com.dhama.mybase.core.usage.monthUsage
import com.dhama.mybase.core.usage.resetLabel
import com.dhama.mybase.core.usage.usageLevel
import com.dhama.mybase.ui.usage.OfflineStrip
import com.dhama.mybase.ui.usage.PaywallCard
import com.dhama.mybase.ui.usage.UsageWarning
import com.dhama.mybase.core.voice.AMPLITUDE_POLL_MS
import com.dhama.mybase.core.voice.CANCEL_SLIDE_DP
import com.dhama.mybase.core.voice.VoicePlayer
import com.dhama.mybase.core.voice.VoiceRecorder
import com.dhama.mybase.core.voice.VoiceRelease
import com.dhama.mybase.core.voice.voiceReleaseAction
import com.dhama.mybase.ui.theme.companionColors
import java.io.File
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val prompts = listOf(
    "Tell her about your day",
    "Ask what she's been thinking about",
    "Introduce yourself",
)

private const val STAMP_GAP_MS = 5 * 60 * 1000L

@Composable
fun ChatScreen(
    onSeePlans: (() -> Unit)? = null,
    onHistory: (() -> Unit)? = null,
    viewModel: ChatViewModel = hiltViewModel(),
) {
    val messages by viewModel.messages.collectAsState()
    val companion by viewModel.companion.collectAsState()
    val draft by viewModel.draft.collectAsState()
    val warningDismissed by viewModel.warningDismissedPeriod.collectAsState()
    val usage = monthUsage(
        messages.map { CountedMessage(it.role, it.createdAtEpochMs, it.durationMs) },
        System.currentTimeMillis(),
    )
    val messageLevel = usageLevel(usage.messages, FREE_MESSAGE_LIMIT)
    val showWarning = METERING_ENFORCED &&
        messageLevel == UsageLevel.NEARING &&
        warningDismissed != usage.periodStartEpochMs.toString()
    val showWall = METERING_ENFORCED && messageLevel == UsageLevel.WALL
    val streaming = messages.any { it.delivery == ChatRepositoryImpl.DELIVERY_STREAMING }
    val listState = rememberLazyListState()
    var selected by remember { mutableStateOf<ChatMessageEntity?>(null) }
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val name = companion?.name ?: "Chat"
    val recorder = remember { VoiceRecorder(File(context.filesDir, "voice-notes")) }
    val player = remember { VoicePlayer(context) }
    var recording by remember { mutableStateOf(false) }
    var locked by remember { mutableStateOf(false) }
    var cancelling by remember { mutableStateOf(false) }
    var elapsedMs by remember { mutableLongStateOf(0L) }
    var amplitudes by remember { mutableStateOf<List<Float>>(emptyList()) }
    var showRationale by remember { mutableStateOf(false) }
    var micDenied by remember { mutableStateOf(false) }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        micDenied = !granted
    }
    DisposableEffect(recorder, player) {
        onDispose {
            recorder.cancel()
            player.release()
        }
    }
    LaunchedEffect(recording) {
        if (!recording) return@LaunchedEffect
        while (isActive && recorder.isRecording) {
            amplitudes = recorder.poll()
            elapsedMs = recorder.elapsedMs()
            delay(AMPLITUDE_POLL_MS)
        }
    }

    fun micGranted(): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    }

    fun beginRecording() {
        if (recording || streaming) return
        if (!micGranted()) {
            showRationale = true
            return
        }
        val started = runCatching { recorder.start(context) }.isSuccess
        if (!started) {
            recorder.cancel()
            return
        }
        recording = true
        locked = false
        cancelling = false
        elapsedMs = 0L
        amplitudes = emptyList()
    }

    fun finishRecording(slideXDp: Float) {
        if (!recorder.isRecording) return
        when (voiceReleaseAction(recorder.elapsedMs(), slideXDp, locked)) {
            VoiceRelease.Lock -> locked = true
            VoiceRelease.Cancel -> {
                recorder.cancel()
                recording = false
                locked = false
                cancelling = false
            }
            VoiceRelease.Send -> {
                val note = recorder.stop()
                recording = false
                locked = false
                cancelling = false
                if (note != null) viewModel.sendVoice(note.path, note.durationMs)
            }
        }
    }

    fun commitLocked() {
        val note = recorder.stop()
        recording = false
        locked = false
        cancelling = false
        if (note != null) viewModel.sendVoice(note.path, note.durationMs)
    }

    fun discardRecording() {
        recorder.cancel()
        recording = false
        locked = false
        cancelling = false
    }

    LaunchedEffect(messages.size, messages.lastOrNull()?.text) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.lastIndex)
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .imePadding(),
    ) {
        Row(
            Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CompanionPortrait(name, companion?.avatarUrl.orEmpty(), 40.dp)
            Text(
                name,
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier
                    .padding(start = 12.dp)
                    .weight(1f)
                    .semantics { heading() },
            )
            if (companion?.conversationId != null && onHistory != null) {
                TextButton(onClick = onHistory) { Text("History") }
            }
        }
        Text(
            when {
                recording -> "Recording…"
                streaming -> "Typing…"
                companion?.conversationId != null -> "Active now"
                else -> "On this phone"
            },
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .padding(horizontal = 20.dp)
                .semantics {
                    if (recording) contentDescription = "Recording"
                    else if (streaming) contentDescription = "$name is typing"
                },
        )
        if (companion?.conversationId == null) {
            OfflineStrip(Modifier.padding(horizontal = 20.dp, vertical = 8.dp))
        }
        if (showWarning) {
            UsageWarning(
                name = name,
                remaining = (FREE_MESSAGE_LIMIT - usage.messages).coerceAtLeast(0),
                resetLabel = resetLabel(usage.resetEpochMs),
                onDismiss = { viewModel.dismissUsageWarning(usage.periodStartEpochMs) },
                modifier = Modifier.padding(horizontal = 20.dp),
            )
        }
        if (messages.size <= 1) {
            Column(
                Modifier
                    .weight(1f)
                    .padding(horizontal = 20.dp),
                verticalArrangement = Arrangement.Center,
            ) {
                messages.firstOrNull()?.let { greeting ->
                    IncomingBubble(greeting.text)
                }
                Spacer(Modifier.height(16.dp))
                prompts.forEach { prompt ->
                    TextButton(
                        onClick = { viewModel.send(prompt) },
                        enabled = !streaming && companion != null && !showWall,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(prompt, modifier = Modifier.fillMaxWidth())
                    }
                }
            }
        } else {
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 12.dp),
                contentPadding = PaddingValues(vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                itemsIndexed(messages, key = { _, message -> message.id }) { index, message ->
                    val previous = messages.getOrNull(index - 1)
                    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (needsStamp(previous, message)) {
                            Text(
                                formatStamp(message.createdAtEpochMs),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 4.dp),
                            )
                        }
                        if (message.kind == ChatMessageEntity.KIND_SYSTEM) {
                            Text(
                                message.text,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth(),
                            )
                        } else {
                            MessageRow(
                                message = message,
                                senderName = name,
                                playing = player.playingPath == message.audioPath && message.audioPath.isNotBlank(),
                                onToggleVoice = { player.toggle(message.audioPath) },
                                onLongClick = { selected = message },
                                onRetry = { viewModel.retry(message) },
                            )
                        }
                    }
                }
            }
        }
        if (micDenied) {
            Text(
                "Microphone is off. Allow it in system settings to record a voice note.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(horizontal = 20.dp),
            )
        }
        if (showWall) {
            PaywallCard(
                name = name,
                resetLabel = resetLabel(usage.resetEpochMs),
                onSeePlans = onSeePlans,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            )
        } else {
            Composer(
                value = draft,
                streaming = streaming,
                enabled = companion != null,
                recording = recording,
                locked = locked,
                cancelling = cancelling,
                elapsedMs = elapsedMs,
                amplitudes = amplitudes,
                onChange = viewModel::updateDraft,
                onSend = { viewModel.send() },
                onStop = viewModel::stop,
                onMicDown = ::beginRecording,
                onMicDrag = { cancelling = it <= -CANCEL_SLIDE_DP && !locked },
                onMicUp = ::finishRecording,
                onVoiceSend = ::commitLocked,
                onVoiceCancel = ::discardRecording,
            )
        }
    }

    if (showRationale) {
        AlertDialog(
            onDismissRequest = { showRationale = false },
            title = { Text("Microphone") },
            text = { Text("Hold the mic to record a voice note. A short tap locks it so you can send without holding. The recording stays on this phone.") },
            confirmButton = {
                TextButton(onClick = {
                    showRationale = false
                    permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                }) { Text("Continue") }
            },
            dismissButton = {
                TextButton(onClick = { showRationale = false }) { Text("Not now") }
            },
        )
    }

    selected?.let { message ->
        val outgoing = message.role == ChatRepositoryImpl.ROLE_USER
        AlertDialog(
            onDismissRequest = { selected = null },
            title = { Text(if (outgoing) "Your message" else name) },
            text = {
                Text(
                    if (outgoing) "Copy it or remove it from this thread."
                    else "Copy it or remove it from this thread. Anything she already remembered stays in Memory.",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.delete(message)
                        selected = null
                    },
                ) {
                    Text("Delete", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                Row {
                    if (!outgoing && message.kind != ChatMessageEntity.KIND_AUDIO) {
                        TextButton(onClick = {}, enabled = false) { Text("Speak") }
                        TextButton(onClick = {}, enabled = false) { Text("Regenerate") }
                    }
                    TextButton(
                        onClick = {
                            scope.launch {
                                clipboard.setClipEntry(
                                    ClipEntry(ClipData.newPlainText("message", message.text)),
                                )
                            }
                            selected = null
                        },
                    ) { Text("Copy") }
                }
            },
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MessageRow(
    message: ChatMessageEntity,
    senderName: String,
    playing: Boolean,
    onToggleVoice: () -> Unit,
    onLongClick: () -> Unit,
    onRetry: () -> Unit,
) {
    val outgoing = message.role == ChatRepositoryImpl.ROLE_USER
    val streaming = message.delivery == ChatRepositoryImpl.DELIVERY_STREAMING
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = if (outgoing) Arrangement.End else Arrangement.Start,
    ) {
        val shape = if (outgoing) {
            RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp, bottomEnd = 6.dp, bottomStart = 20.dp)
        } else {
            RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp, bottomEnd = 20.dp, bottomStart = 6.dp)
        }
        val background = if (outgoing) {
            MaterialTheme.companionColors.bubbleOutgoing
        } else {
            MaterialTheme.companionColors.bubbleIncoming
        }
        val color = if (outgoing) {
            MaterialTheme.companionColors.onBubbleOutgoing
        } else {
            MaterialTheme.companionColors.onBubbleIncoming
        }
        val failed = message.delivery == ChatRepositoryImpl.DELIVERY_FAILED
        val spoken = when {
            message.kind == ChatMessageEntity.KIND_AUDIO -> "$senderName. Voice note ${message.durationMs / 1000} seconds"
            message.kind == ChatMessageEntity.KIND_IMAGE -> "$senderName. Photo"
            streaming && message.text.isBlank() -> "$senderName is typing"
            outgoing -> "You. ${message.text}"
            else -> "$senderName. ${message.text}"
        }
        Column(horizontalAlignment = if (outgoing) Alignment.End else Alignment.Start) {
            Column(Modifier.alpha(if (failed) 0.5f else 1f)) {
                when (message.kind) {
                    ChatMessageEntity.KIND_IMAGE -> ImageNote(message.audioPath)
                    ChatMessageEntity.KIND_AUDIO -> VoiceNoteContent(
                        text = message.text,
                        durationMs = message.durationMs,
                        playing = playing,
                        color = color,
                        onToggle = onToggleVoice,
                        modifier = Modifier
                            .widthIn(max = 280.dp)
                            .clip(shape)
                            .background(background)
                            .combinedClickable(onClick = {}, onLongClick = onLongClick)
                            .semantics { contentDescription = spoken }
                            .padding(vertical = 4.dp, horizontal = 4.dp),
                    )
                    else -> Text(
                        text = message.text.ifBlank { "…" },
                        color = color,
                        modifier = Modifier
                            .widthIn(max = 280.dp)
                            .clip(shape)
                            .background(background)
                            .combinedClickable(onClick = {}, onLongClick = onLongClick)
                            .semantics {
                                contentDescription = spoken
                                if (streaming) liveRegion = LiveRegionMode.Polite
                            }
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                    )
                }
            }
            if (failed) {
                TextButton(onClick = onRetry, modifier = Modifier.heightIn(min = 48.dp)) {
                    Text("Not sent · Retry", color = MaterialTheme.colorScheme.error)
                }
            } else if (
                message.kind == ChatMessageEntity.KIND_AUDIO &&
                message.text.isBlank() &&
                !message.audioPath.startsWith("http")
            ) {
                Text(
                    "On this phone",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp, start = 4.dp, end = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun IncomingBubble(text: String) {
    Text(
        text,
        color = MaterialTheme.companionColors.onBubbleIncoming,
        modifier = Modifier
            .clip(RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp, bottomEnd = 20.dp, bottomStart = 6.dp))
            .background(MaterialTheme.companionColors.bubbleIncoming)
            .padding(14.dp),
    )
}

@Composable
private fun Composer(
    value: String,
    streaming: Boolean,
    enabled: Boolean,
    recording: Boolean,
    locked: Boolean,
    cancelling: Boolean,
    elapsedMs: Long,
    amplitudes: List<Float>,
    onChange: (String) -> Unit,
    onSend: () -> Unit,
    onStop: () -> Unit,
    onMicDown: () -> Unit,
    onMicDrag: (Float) -> Unit,
    onMicUp: (Float) -> Unit,
    onVoiceSend: () -> Unit,
    onVoiceCancel: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (recording) {
            RecordingMeter(
                amplitudes = amplitudes,
                elapsedMs = elapsedMs,
                cancelling = cancelling,
                locked = locked,
                modifier = Modifier.weight(1f),
            )
        } else {
            OutlinedTextField(
                value = value,
                onValueChange = onChange,
                enabled = enabled && !streaming,
                modifier = Modifier
                    .weight(1f)
                    .heightIn(min = 52.dp),
                placeholder = { Text("Message") },
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = { onSend() }),
                maxLines = 4,
            )
        }
        if (!locked) {
            HoldMic(
                enabled = enabled && !streaming,
                recording = recording,
                onDown = onMicDown,
                onDragDp = onMicDrag,
                onUp = onMicUp,
            )
        }
        when {
            streaming -> IconButton(onClick = onStop) {
                Icon(Icons.Default.Stop, contentDescription = "Stop")
            }
            locked -> Row {
                TextButton(onClick = onVoiceCancel, modifier = Modifier.heightIn(min = 48.dp)) { Text("Cancel") }
                TextButton(onClick = onVoiceSend, modifier = Modifier.heightIn(min = 48.dp)) { Text("Send") }
            }
            else -> IconButton(onClick = onSend, enabled = enabled && value.isNotBlank()) {
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send")
            }
        }
    }
}

private fun needsStamp(previous: ChatMessageEntity?, current: ChatMessageEntity): Boolean {
    if (previous == null) return true
    if (current.createdAtEpochMs - previous.createdAtEpochMs >= STAMP_GAP_MS) return true
    val zone = ZoneId.systemDefault()
    val previousDay = Instant.ofEpochMilli(previous.createdAtEpochMs).atZone(zone).toLocalDate()
    val currentDay = Instant.ofEpochMilli(current.createdAtEpochMs).atZone(zone).toLocalDate()
    return previousDay != currentDay
}

private fun formatStamp(epochMs: Long): String {
    val zone = ZoneId.systemDefault()
    val time = Instant.ofEpochMilli(epochMs).atZone(zone)
    val clock = time.format(DateTimeFormatter.ofPattern("h:mm a"))
    val today = java.time.LocalDate.now(zone)
    return when (val day = time.toLocalDate()) {
        today -> clock
        today.minusDays(1) -> "Yesterday · $clock"
        else -> "${day.format(DateTimeFormatter.ofPattern("MMM d"))} · $clock"
    }
}
