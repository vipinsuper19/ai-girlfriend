@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.dhama.mybase.ui.memory

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.dhama.mybase.core.db.entity.MemoryEntity
import com.dhama.mybase.core.memory.importanceReading
import com.dhama.mybase.core.memory.memoryTypeLabel
import com.dhama.mybase.ui.theme.companionColors
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val memoryTypes = listOf("PROFILE", "PREFERENCE", "RELATIONSHIP", "CONVERSATION", "FACT")

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MemoryListScreen(
    companionName: String,
    onOpen: (String) -> Unit,
    viewModel: MemoryViewModel = hiltViewModel(),
) {
    val memories by viewModel.memories.collectAsState()
    val hidden by viewModel.hiddenIds.collectAsState()
    var filter by remember { mutableStateOf<String?>(null) }
    val visible = memories.filter { it.id !in hidden && (filter == null || it.type == filter) }
    val name = companionName.ifBlank { "She" }
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 12.dp),
    ) {
        Text(
            "Memory",
            style = MaterialTheme.typography.headlineMedium,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(Modifier.height(8.dp))
        Text(
            if (memories.isEmpty()) {
                "$name hasn't kept anything yet. Memories come from talking to her — she keeps what matters, not the whole conversation."
            } else {
                "${memories.size} things $name remembers about you. Edit or delete anything here — she'll forget it immediately."
            },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(16.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = filter == null, onClick = { filter = null }, label = { Text("All") })
            memoryTypes.forEach { type ->
                FilterChip(
                    selected = filter == type,
                    onClick = { filter = type },
                    label = { Text(memoryTypeLabel(type)) },
                )
            }
        }
        Spacer(Modifier.height(16.dp))
        if (visible.isEmpty()) {
            Text(
                if (memories.isEmpty()) "Nothing to edit until she notices something."
                else "No ${memoryTypeLabel(filter.orEmpty()).lowercase()} memories.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                visible.forEach { memory ->
                    MemoryCard(memory, onClick = { onOpen(memory.id) })
                }
            }
        }
    }
}

@Composable
private fun MemoryCard(memory: MemoryEntity, onClick: () -> Unit) {
    val (background, foreground) = typeColors(memory.type)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerLow)
            .clickable(onClick = onClick)
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                memoryTypeLabel(memory.type),
                color = foreground,
                style = MaterialTheme.typography.labelMedium,
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(background)
                    .padding(horizontal = 8.dp, vertical = 4.dp),
            )
            Spacer(Modifier.weight(1f))
            Text(
                relativeTime(memory.createdAtEpochMs),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Spacer(Modifier.height(10.dp))
        Text(memory.content)
        Spacer(Modifier.height(10.dp))
        ImportanceBar(memory.importance)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MemoryDetailScreen(
    memoryId: String,
    onBack: () -> Unit,
    viewModel: MemoryViewModel = hiltViewModel(),
) {
    val memories by viewModel.memories.collectAsState()
    val memory = memories.firstOrNull { it.id == memoryId }
    Column(Modifier.fillMaxSize()) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(end = 8.dp)) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
            Text("Memory", style = MaterialTheme.typography.titleLarge, modifier = Modifier.semantics { heading() })
        }
        if (memory == null) {
            Text(
                "This memory is gone.",
                modifier = Modifier.padding(20.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            return
        }
        DetailBody(memory, onBack, viewModel)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DetailBody(
    memory: MemoryEntity,
    onBack: () -> Unit,
    viewModel: MemoryViewModel,
) {
    var content by remember(memory.id) { mutableStateOf(memory.content) }
    var type by remember(memory.id) { mutableStateOf(memory.type) }
    var importance by remember(memory.id) { mutableStateOf(memory.importance.toFloat()) }
    val dirty = content.trim() != memory.content || type != memory.type || importance.toInt() != memory.importance
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp),
    ) {
        Text("Type", style = MaterialTheme.typography.labelLarge)
        Spacer(Modifier.height(8.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            memoryTypes.forEach { option ->
                FilterChip(
                    selected = type == option,
                    onClick = { type = option },
                    label = { Text(memoryTypeLabel(option)) },
                )
            }
        }
        Spacer(Modifier.height(16.dp))
        OutlinedTextField(
            value = content,
            onValueChange = { content = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("What she remembers") },
            minLines = 3,
        )
        Spacer(Modifier.height(16.dp))
        Text("Importance ${importance.toInt()}", style = MaterialTheme.typography.labelLarge)
        Slider(value = importance, onValueChange = { importance = it }, valueRange = 0f..100f)
        Text(importanceReading(importance.toInt()), color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(20.dp))
        Text("Where this came from", style = MaterialTheme.typography.titleMedium, modifier = Modifier.semantics { heading() })
        Spacer(Modifier.height(8.dp))
        ProvenanceRow("Source", sourceLabel(memory.source))
        ProvenanceRow("First remembered", rememberedOn(memory.createdAtEpochMs))
        ProvenanceRow("Confidence", "%.2f".format(memory.confidence))
        Spacer(Modifier.height(20.dp))
        TextButton(
            onClick = { viewModel.save(memory.id, content, type, importance.toInt()) },
            enabled = dirty && content.isNotBlank(),
            modifier = Modifier.heightIn(min = 48.dp),
        ) { Text("Save") }
        TextButton(
            onClick = {
                viewModel.stageDelete(memory)
                onBack()
            },
            modifier = Modifier.heightIn(min = 48.dp),
        ) { Text("Delete", color = MaterialTheme.colorScheme.error) }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
fun MemoryPrivacyScreen(
    companionName: String,
    onBack: () -> Unit,
    viewModel: MemoryViewModel = hiltViewModel(),
) {
    val memories by viewModel.memories.collectAsState()
    val clearing by viewModel.clearing.collectAsState()
    var confirm by remember { mutableStateOf(false) }
    val weekAgo = System.currentTimeMillis() - 7L * 24 * 60 * 60 * 1000
    val thisWeek = memories.count { it.createdAtEpochMs >= weekAgo }
    val average = if (memories.isEmpty()) 0 else memories.sumOf { it.importance } / memories.size
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
            Text(
                "Memory & privacy",
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.semantics { heading() },
            )
        }
        Spacer(Modifier.height(8.dp))
        val name = companionName.ifBlank { "She" }
        Text(
            "$name doesn't store your conversations as memories. She keeps short things she noticed, and you can read or delete every one of them.",
            modifier = Modifier
                .clip(RoundedCornerShape(16.dp))
                .background(MaterialTheme.colorScheme.tertiaryContainer)
                .padding(16.dp),
            color = MaterialTheme.colorScheme.onTertiaryContainer,
        )
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StatTile("Remembered", memories.size.toString(), Modifier.weight(1f))
            StatTile("This week", thisWeek.toString(), Modifier.weight(1f))
            StatTile("Importance", average.toString(), Modifier.weight(1f))
        }
        Spacer(Modifier.height(20.dp))
        DisabledControl("Pause new memories", "No endpoint yet")
        DisabledControl("Export my data", "No endpoint yet")
        Spacer(Modifier.height(12.dp))
        TextButton(
            onClick = { confirm = true },
            enabled = memories.isNotEmpty() && !clearing,
            modifier = Modifier.heightIn(min = 48.dp),
        ) {
            Text(if (clearing) "Clearing…" else "Clear all memories", color = MaterialTheme.colorScheme.error)
        }
    }
    if (confirm) {
        ClearAllDialog(
            onDismiss = { confirm = false },
            onConfirm = {
                confirm = false
                viewModel.clearAll()
            },
        )
    }
}

@Composable
private fun ClearAllDialog(onDismiss: () -> Unit, onConfirm: () -> Unit) {
    var typed by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Clear all memories") },
        text = {
            Column {
                Text("This cannot be undone. Everything stored here is forgotten. Type DELETE to confirm.")
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = typed,
                    onValueChange = { typed = it },
                    label = { Text("Type DELETE") },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = typed == "DELETE") {
                Text("Clear all", color = MaterialTheme.colorScheme.error)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}

@Composable
private fun StatTile(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceContainer)
            .padding(12.dp),
    ) {
        Text(value, style = MaterialTheme.typography.titleLarge)
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun DisabledControl(label: String, reason: String) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
            .semantics(mergeDescendants = true) {},
    ) {
        Text(label, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f))
        Text(reason, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun ProvenanceRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value)
    }
}

@Composable
private fun ImportanceBar(score: Int) {
    val fraction = score.coerceIn(0, 100) / 100f
    Row(verticalAlignment = Alignment.CenterVertically) {
        LinearProgressIndicator(
            progress = { fraction },
            modifier = Modifier
                .weight(1f)
                .height(6.dp)
                .semantics {
                    progressBarRangeInfo = ProgressBarRangeInfo(fraction, 0f..1f)
                },
        )
        Text(
            score.toString(),
            modifier = Modifier.padding(start = 8.dp),
            style = MaterialTheme.typography.labelMedium,
        )
    }
}

@Composable
private fun typeColors(type: String): Pair<Color, Color> = when (type) {
    "PROFILE" -> MaterialTheme.colorScheme.primaryContainer to MaterialTheme.colorScheme.onPrimaryContainer
    "PREFERENCE" -> MaterialTheme.colorScheme.tertiaryContainer to MaterialTheme.colorScheme.onTertiaryContainer
    "FACT" -> MaterialTheme.colorScheme.secondaryContainer to MaterialTheme.colorScheme.onSecondaryContainer
    "RELATIONSHIP" -> MaterialTheme.companionColors.successContainer to MaterialTheme.companionColors.onSuccessContainer
    else -> MaterialTheme.colorScheme.surfaceContainerHighest to MaterialTheme.colorScheme.onSurface
}

private fun relativeTime(epochMs: Long): String {
    val minutes = (System.currentTimeMillis() - epochMs) / 60_000
    return when {
        minutes < 1 -> "Just now"
        minutes < 60 -> "${minutes}m ago"
        minutes < 60 * 24 -> "${minutes / 60}h ago"
        minutes < 60 * 24 * 7 -> "${minutes / (60 * 24)}d ago"
        else -> "${minutes / (60 * 24 * 7)}w ago"
    }
}

private fun rememberedOn(epochMs: Long): String {
    val time = Instant.ofEpochMilli(epochMs).atZone(ZoneId.systemDefault())
    return time.format(DateTimeFormatter.ofPattern("MMM d, yyyy"))
}

private fun sourceLabel(source: String): String = when (source) {
    "USER_MESSAGE" -> "Something you said"
    "ASSISTANT_MESSAGE" -> "Something she said"
    "AI_EXTRACTION" -> "Noticed in conversation"
    "USER_INPUT" -> "Added by you"
    else -> source
}
