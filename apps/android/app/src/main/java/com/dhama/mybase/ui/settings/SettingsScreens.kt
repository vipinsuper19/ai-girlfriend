@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.dhama.mybase.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.activity.ComponentActivity
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.ui.platform.LocalContext
import com.dhama.mybase.core.memory.togetherLine
import com.dhama.mybase.core.model.CompanionDraft
import com.dhama.mybase.core.model.SavedCompanion

private val traitOptions = listOf(
    "Caring", "Playful", "Curious", "Calm", "Confident", "Witty", "Ambitious", "Creative",
)

@Composable
fun YouSettingsScreen(
    onProfile: () -> Unit,
    onPrivacy: () -> Unit,
    onPlans: () -> Unit,
    onLogout: () -> Unit,
    viewModel: SettingsViewModel = rememberSettingsViewModel(),
) {
    val displayName by viewModel.displayName.collectAsState()
    val email by viewModel.email.collectAsState()
    val privacy by viewModel.screenPrivacy.collectAsState()
    val theme by viewModel.themeMode.collectAsState()
    val companion by viewModel.companion.collectAsState()
    var nameDraft by remember(displayName) { mutableStateOf(displayName) }
    var confirmDelete by remember { mutableStateOf(false) }
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 16.dp),
    ) {
        Text("You", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.semantics { heading() })
        Spacer(Modifier.height(16.dp))
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(MaterialTheme.colorScheme.surfaceContainerLow)
                .padding(16.dp),
        ) {
            Text("Display name", style = MaterialTheme.typography.labelLarge)
            OutlinedTextField(
                value = nameDraft,
                onValueChange = { nameDraft = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                placeholder = { Text("Your name") },
            )
            if (nameDraft.trim() != displayName) {
                TextButton(onClick = { viewModel.setDisplayName(nameDraft) }) { Text("Save name") }
            }
        }
        Spacer(Modifier.height(20.dp))
        SectionLabel("Companion")
        SettingsRow("Her profile", companion?.name ?: "Not created yet", onClick = onProfile)
        SettingsRow("Memory & privacy", "What she keeps", onClick = onPrivacy)
        SectionLabel("Privacy")
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .semantics(mergeDescendants = true) {},
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text("Screen privacy")
                Text(
                    "Hide this app in recents",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Switch(checked = privacy, onCheckedChange = viewModel::setScreenPrivacy)
        }
        DisabledRow("Email", email.ifBlank { "No email-change endpoint" })
        DisabledRow("Change password", "No endpoint yet")
        SectionLabel("Subscription")
        SettingsRow("Plan", "Free", onClick = onPlans)
        SectionLabel("App")
        Text("Theme", style = MaterialTheme.typography.bodyLarge)
        ThemePicker(selected = theme.ifBlank { "system" }, onSelect = viewModel::setThemeMode)
        DisabledRow("Notifications", "No notifications module yet")
        Spacer(Modifier.height(24.dp))
        TextButton(
            onClick = { confirmDelete = true },
            modifier = Modifier
                .heightIn(min = 48.dp)
                .semantics { role = Role.Button },
        ) { Text("Delete account", color = MaterialTheme.colorScheme.error) }
        Spacer(Modifier.height(32.dp))
        TextButton(
            onClick = onLogout,
            modifier = Modifier
                .align(Alignment.CenterHorizontally)
                .heightIn(min = 48.dp)
                .semantics { role = Role.Button },
        ) { Text("Log out", color = MaterialTheme.colorScheme.error) }
        Spacer(Modifier.height(24.dp))
    }
    if (confirmDelete) {
        DeleteAccountDialog(
            onDismiss = { confirmDelete = false },
            onConfirm = {
                confirmDelete = false
                viewModel.deleteAccount()
            },
        )
    }
}

@Composable
fun CompanionProfileScreen(
    onBack: () -> Unit,
    onEdit: () -> Unit,
    viewModel: SettingsViewModel = rememberSettingsViewModel(),
) {
    val companion by viewModel.companion.collectAsState()
    val memories by viewModel.memories.collectAsState()
    var confirmArchive by remember { mutableStateOf(false) }
    val saved = companion
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
            Spacer(Modifier.weight(1f))
            TextButton(onClick = onEdit, enabled = saved != null) { Text("Edit") }
        }
        if (saved == null) {
            Text("No companion yet.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            return
        }
        Monogram(saved.name, 112.dp)
        Text(
            saved.name,
            style = MaterialTheme.typography.displayMedium,
            modifier = Modifier
                .padding(top = 12.dp)
                .semantics { heading() },
        )
        Text(
            togetherLine(saved.relationship, saved.createdAtEpochMs, System.currentTimeMillis()),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(16.dp))
        FlowTraits(saved.traits)
        Spacer(Modifier.height(20.dp))
        Meter("Warmth", saved.empathyLevel)
        Meter("Humour", saved.humorLevel)
        Meter("Flirtiness", saved.flirtLevel)
        Meter("Romance", saved.romanceLevel)
        Spacer(Modifier.height(16.dp))
        GroupLine("Look", "${saved.style} · ${saved.hairColor} hair · ${saved.eyeColor} eyes · ${saved.skinTone} skin")
        GroupLine("Voice", "${saved.voiceLabel} voice")
        GroupLine("Memory", "${memories.size} things remembered")
        Spacer(Modifier.height(28.dp))
        TextButton(
            onClick = { confirmArchive = true },
            modifier = Modifier
                .heightIn(min = 48.dp)
                .semantics { role = Role.Button },
        ) { Text("Archive ${saved.name}", color = MaterialTheme.colorScheme.error) }
        Spacer(Modifier.height(24.dp))
    }
    if (confirmArchive && saved != null) {
        AlertDialog(
            onDismissRequest = { confirmArchive = false },
            title = { Text("Archive ${saved.name}") },
            text = { Text("She leaves the app. Conversations and memories are kept. There is no way to bring her back from here.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmArchive = false
                    viewModel.archive()
                }) { Text("Archive", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { confirmArchive = false }) { Text("Cancel") } },
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun EditCompanionScreen(
    onBack: () -> Unit,
    viewModel: SettingsViewModel = rememberSettingsViewModel(),
) {
    val companion by viewModel.companion.collectAsState()
    val saved = companion
    Column(Modifier.fillMaxSize()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
            Text("Edit", style = MaterialTheme.typography.titleLarge, modifier = Modifier.semantics { heading() })
        }
        if (saved == null) return
        EditBody(saved, onBack, viewModel)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun EditBody(saved: SavedCompanion, onBack: () -> Unit, viewModel: SettingsViewModel) {
    var revision by remember { mutableIntStateOf(0) }
    var name by remember(saved.name, revision) { mutableStateOf(saved.name) }
    var traits by remember(saved.traits, revision) { mutableStateOf(saved.traits) }
    var warmth by remember(saved.empathyLevel, revision) { mutableFloatStateOf(saved.empathyLevel.toFloat()) }
    var humour by remember(saved.humorLevel, revision) { mutableFloatStateOf(saved.humorLevel.toFloat()) }
    var flirt by remember(saved.flirtLevel, revision) { mutableFloatStateOf(saved.flirtLevel.toFloat()) }
    var romance by remember(saved.romanceLevel, revision) { mutableFloatStateOf(saved.romanceLevel.toFloat()) }
    val changes = listOf(
        name.trim() != saved.name,
        traits != saved.traits,
        warmth.toInt() != saved.empathyLevel,
        humour.toInt() != saved.humorLevel,
        flirt.toInt() != saved.flirtLevel,
        romance.toInt() != saved.romanceLevel,
    ).count { it }
    Column(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp),
        ) {
            Text(
                "Changing her personality affects how she talks from here on. Everything she already remembers stays.",
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(MaterialTheme.colorScheme.tertiaryContainer)
                    .padding(16.dp),
                color = MaterialTheme.colorScheme.onTertiaryContainer,
            )
            Spacer(Modifier.height(16.dp))
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Name") },
                singleLine = true,
            )
            Spacer(Modifier.height(12.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                traitOptions.forEach { trait ->
                    FilterChip(
                        selected = trait in traits,
                        onClick = {
                            traits = when {
                                trait in traits -> traits - trait
                                traits.size >= CompanionDraft.MAX_TRAITS -> traits
                                else -> traits + trait
                            }
                        },
                        label = { Text(trait) },
                    )
                }
            }
            Level("Warmth", warmth) { warmth = it }
            Level("Humour", humour) { humour = it }
            Level("Flirtiness", flirt) { flirt = it }
            Level("Romance", romance) { romance = it }
        }
        if (changes > 0) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surfaceContainer)
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "$changes unsaved ${if (changes == 1) "change" else "changes"}",
                    modifier = Modifier.weight(1f),
                )
                TextButton(onClick = { revision++ }) { Text("Discard") }
                TextButton(
                    onClick = {
                        val draft = CompanionDraft(
                            style = saved.style,
                            hairColor = saved.hairColor,
                            eyeColor = saved.eyeColor,
                            skinTone = saved.skinTone,
                            traits = traits,
                            empathyLevel = warmth.toInt(),
                            humorLevel = humour.toInt(),
                            flirtLevel = flirt.toInt(),
                            romanceLevel = romance.toInt(),
                            voiceLabel = saved.voiceLabel,
                            relationship = saved.relationship,
                            name = name.trim(),
                        )
                        viewModel.saveCompanion(saved, draft)
                        onBack()
                    },
                    enabled = name.trim().length in 2..100,
                ) { Text("Save") }
            }
        }
    }
}

@Composable
fun SubscriptionScreen(onBack: () -> Unit) {
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
            Text("Plan", style = MaterialTheme.typography.titleLarge, modifier = Modifier.semantics { heading() })
        }
        Text(
            "Usage isn't connected on this phone yet. These are the allowances, with no upgrade from here.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(16.dp))
        PlanCard("Free", "Current plan", listOf("100 messages", "10 voice minutes", "5 images"))
        PlanCard("Premium", "Read only", listOf("Unlimited messages", "300 voice minutes", "100 images"))
        PlanCard("Premium Plus", "Read only", listOf("Unlimited messages", "300 voice minutes", "100 images", "Calls"))
    }
}

@Composable
private fun PlanCard(title: String, status: String, lines: List<String>) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerLow)
            .padding(16.dp),
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        Text(status, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(8.dp))
        lines.forEach { Text(it) }
    }
}

@Composable
private fun DeleteAccountDialog(onDismiss: () -> Unit, onConfirm: () -> Unit) {
    var typed by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Delete account") },
        text = {
            Column {
                Text("This removes the account, her, every conversation, and everything she remembers. Type DELETE to confirm.")
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = typed,
                    onValueChange = { typed = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Type DELETE") },
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = typed == "DELETE") {
                Text("Delete account", color = MaterialTheme.colorScheme.error)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(top = 16.dp, bottom = 4.dp),
    )
}

@Composable
private fun SettingsRow(label: String, value: String, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .clickable(onClick = onClick)
            .semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, modifier = Modifier.weight(1f))
        Text(value, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun DisabledRow(label: String, reason: String) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp)
            .semantics(mergeDescendants = true) {},
    ) {
        Text(label, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f))
        Text(reason, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun ThemePicker(selected: String, onSelect: (String) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(vertical = 8.dp)) {
        listOf("system" to "System", "light" to "Light", "dark" to "Dark").forEach { (value, label) ->
            FilterChip(selected = selected == value, onClick = { onSelect(value) }, label = { Text(label) })
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FlowTraits(traits: List<String>) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        traits.forEach { trait ->
            Text(
                trait,
                modifier = Modifier
                    .padding(bottom = 8.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(MaterialTheme.colorScheme.secondaryContainer)
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                color = MaterialTheme.colorScheme.onSecondaryContainer,
            )
        }
    }
}

@Composable
private fun Meter(label: String, level: Int) {
    val fraction = level.coerceIn(0, 100) / 100f
    Column(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label)
            Text(level.toString(), color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        LinearProgressIndicator(
            progress = { fraction },
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 4.dp)
                .height(6.dp)
                .semantics { progressBarRangeInfo = ProgressBarRangeInfo(fraction, 0f..1f) },
        )
    }
}

@Composable
private fun GroupLine(label: String, value: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        Text(label, style = MaterialTheme.typography.labelLarge)
        Text(value, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun Level(label: String, value: Float, onChange: (Float) -> Unit) {
    Column(Modifier.fillMaxWidth().padding(top = 8.dp)) {
        Text("$label ${value.toInt()}")
        Slider(
            value = value,
            onValueChange = onChange,
            valueRange = 0f..100f,
            modifier = Modifier.semantics { progressBarRangeInfo = ProgressBarRangeInfo(value / 100f, 0f..1f) },
        )
    }
}

@Composable
private fun Monogram(name: String, diameter: androidx.compose.ui.unit.Dp) {
    Box(
        Modifier
            .size(diameter)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.primaryContainer)
            .border(2.dp, MaterialTheme.colorScheme.primary, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            name.take(1).uppercase(),
            style = MaterialTheme.typography.displayMedium,
            color = MaterialTheme.colorScheme.onPrimaryContainer,
        )
    }
}

@Composable
fun rememberSettingsViewModel(): SettingsViewModel {
    val activity = LocalContext.current.findActivity() as ComponentActivity
    return hiltViewModel(viewModelStoreOwner = activity)
}

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}
