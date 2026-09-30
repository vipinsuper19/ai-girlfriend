package com.dhama.mybase.ui.chat

import android.content.ClipData
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.dhama.mybase.core.data.ChatRepositoryImpl
import com.dhama.mybase.core.db.entity.ChatMessageEntity
import com.dhama.mybase.ui.theme.companionColors
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
    viewModel: ChatViewModel = hiltViewModel(),
) {
    val messages by viewModel.messages.collectAsState()
    val companion by viewModel.companion.collectAsState()
    val draft by viewModel.draft.collectAsState()
    val streaming = messages.any { it.delivery == ChatRepositoryImpl.DELIVERY_STREAMING }
    val listState = rememberLazyListState()
    var selected by remember { mutableStateOf<ChatMessageEntity?>(null) }
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    val name = companion?.name ?: "Chat"

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
        Text(
            name,
            style = MaterialTheme.typography.titleLarge,
            modifier = Modifier
                .padding(horizontal = 20.dp, vertical = 8.dp)
                .semantics { heading() },
        )
        Text(
            if (streaming) "Typing…" else "On this phone",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .padding(horizontal = 20.dp)
                .semantics {
                    if (streaming) contentDescription = "$name is typing"
                },
        )
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
                        enabled = !streaming && companion != null,
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
                        MessageRow(
                            message = message,
                            senderName = name,
                            onLongClick = { selected = message },
                        )
                    }
                }
            }
        }
        Composer(
            value = draft,
            streaming = streaming,
            enabled = companion != null,
            onChange = viewModel::updateDraft,
            onSend = { viewModel.send() },
            onStop = viewModel::stop,
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
                    if (!outgoing) {
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
    onLongClick: () -> Unit,
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
            streaming && message.text.isBlank() -> "$senderName is typing"
            outgoing -> "You. ${message.text}"
            else -> "$senderName. ${message.text}"
        }
        Column(horizontalAlignment = if (outgoing) Alignment.End else Alignment.Start) {
            Text(
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
            if (failed) {
                Text(
                    "Not sent",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
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
    onChange: (String) -> Unit,
    onSend: () -> Unit,
    onStop: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
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
        if (streaming) {
            IconButton(onClick = onStop) {
                Icon(Icons.Default.Stop, contentDescription = "Stop")
            }
        } else {
            IconButton(onClick = onSend, enabled = enabled && value.isNotBlank()) {
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
