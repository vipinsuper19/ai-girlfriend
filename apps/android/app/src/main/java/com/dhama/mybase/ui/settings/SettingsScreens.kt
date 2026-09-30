@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.dhama.mybase.ui.settings

import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts.PickVisualMedia
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
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.activity.ComponentActivity
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.ui.platform.LocalContext
import com.dhama.mybase.core.memory.togetherLine
import com.dhama.mybase.core.network.AVATAR_MAX_BYTES
import com.dhama.mybase.core.network.avatarPhotoError
import com.dhama.mybase.core.network.planCardStatus
import com.dhama.mybase.ui.companion.CompanionPortrait
import com.dhama.mybase.core.model.CompanionDraft
import com.dhama.mybase.core.model.eyeColors
import com.dhama.mybase.core.model.hairColors
import com.dhama.mybase.core.model.lookStyles
import com.dhama.mybase.core.model.relationshipOptions
import com.dhama.mybase.core.model.skinTones
import com.dhama.mybase.core.model.voiceChoices
import com.dhama.mybase.core.model.voiceIdFor
import com.dhama.mybase.core.model.SavedCompanion
import com.dhama.mybase.core.model.companionGender
import com.dhama.mybase.core.model.genderLabel
import com.dhama.mybase.core.usage.CountedMessage
import com.dhama.mybase.core.usage.FREE_IMAGE_LIMIT
import com.dhama.mybase.core.usage.FREE_MESSAGE_LIMIT
import com.dhama.mybase.core.usage.FREE_VOICE_MINUTES
import com.dhama.mybase.core.usage.MonthUsage
import com.dhama.mybase.core.usage.monthUsage
import com.dhama.mybase.core.usage.resetLabel
import com.dhama.mybase.ui.preview.sampleCompanion
import com.dhama.mybase.ui.preview.sampleMemories
import com.dhama.mybase.ui.theme.MyBaseTheme
import com.dhama.mybase.ui.usage.PaywallCard
import com.dhama.mybase.ui.usage.UsageMeter

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
    val plan by viewModel.planLabel.collectAsState()
    val nameMessage by viewModel.nameMessage.collectAsState()
    val email by viewModel.email.collectAsState()
    val privacy by viewModel.screenPrivacy.collectAsState()
    val theme by viewModel.themeMode.collectAsState()
    val companion by viewModel.companion.collectAsState()
    YouSettingsContent(
        displayName = displayName,
        plan = plan,
        nameMessage = nameMessage,
        email = email,
        privacy = privacy,
        theme = theme,
        companionName = companion?.name,
        onProfile = onProfile,
        onPrivacy = onPrivacy,
        onPlans = onPlans,
        onLogout = onLogout,
        onSaveName = viewModel::setDisplayName,
        onScreenPrivacy = viewModel::setScreenPrivacy,
        onTheme = viewModel::setThemeMode,
        onDeleteAccount = viewModel::deleteAccount,
    )
}

@Composable
private fun YouSettingsContent(
    displayName: String,
    plan: String,
    nameMessage: String?,
    email: String,
    privacy: Boolean,
    theme: String,
    companionName: String?,
    onProfile: () -> Unit,
    onPrivacy: () -> Unit,
    onPlans: () -> Unit,
    onLogout: () -> Unit,
    onSaveName: (String) -> Unit,
    onScreenPrivacy: (Boolean) -> Unit,
    onTheme: (String) -> Unit,
    onDeleteAccount: () -> Unit,
) {
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
                TextButton(onClick = { onSaveName(nameDraft) }) { Text("Save name") }
            }
            if (!nameMessage.isNullOrBlank()) {
                Text(nameMessage.orEmpty(), color = MaterialTheme.colorScheme.error)
            }
        }
        Spacer(Modifier.height(20.dp))
        SectionLabel("Companion")
        SettingsRow("Her profile", companionName ?: "Not created yet", onClick = onProfile)
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
            Switch(checked = privacy, onCheckedChange = onScreenPrivacy)
        }
        DisabledRow("Email", email.ifBlank { "No email-change endpoint" })
        DisabledRow("Change password", "No endpoint yet")
        SectionLabel("Subscription")
        SettingsRow("Plan", plan.ifBlank { "Free" }, onClick = onPlans)
        SectionLabel("App")
        Text("Theme", style = MaterialTheme.typography.bodyLarge)
        ThemePicker(selected = theme.ifBlank { "system" }, onSelect = onTheme)
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
                onDeleteAccount()
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
    val photoSaving by viewModel.photoSaving.collectAsState()
    val photoMessage by viewModel.photoMessage.collectAsState()
    val context = LocalContext.current
    val photoPicker = rememberLauncherForActivityResult(PickVisualMedia()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val mime = context.contentResolver.getType(uri).orEmpty()
        val size = context.contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getLong(0) else -1L
        } ?: -1L
        if (size > AVATAR_MAX_BYTES) {
            viewModel.rejectPhoto(avatarPhotoError(mime, size) ?: "That image is over 5MB.")
            return@rememberLauncherForActivityResult
        }
        val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
        if (bytes == null) {
            viewModel.rejectPhoto("Couldn't read that photo.")
            return@rememberLauncherForActivityResult
        }
        viewModel.uploadPhoto(bytes, mime)
    }
    CompanionProfileContent(
        saved = companion,
        memoryCount = memories.size,
        photoSaving = photoSaving,
        photoMessage = photoMessage,
        onBack = onBack,
        onEdit = onEdit,
        onPickPhoto = { photoPicker.launch(PickVisualMediaRequest(PickVisualMedia.ImageOnly)) },
        onArchive = viewModel::archive,
    )
}

@Composable
private fun CompanionProfileContent(
    saved: SavedCompanion?,
    memoryCount: Int,
    photoSaving: Boolean,
    photoMessage: String?,
    onBack: () -> Unit,
    onEdit: () -> Unit,
    onPickPhoto: () -> Unit,
    onArchive: () -> Unit,
) {
    var confirmArchive by remember { mutableStateOf(false) }
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
        CompanionPortrait(saved.name, saved.avatarUrl, 112.dp)
        if (saved.serverId != null) {
            TextButton(
                onClick = onPickPhoto,
                enabled = !photoSaving,
                modifier = Modifier.heightIn(min = 48.dp),
            ) { Text(if (photoSaving) "Saving her photo…" else "Set photo") }
            if (!photoMessage.isNullOrBlank()) {
                Text(photoMessage.orEmpty(), color = MaterialTheme.colorScheme.error)
            }
        } else {
            Text(
                "Sign in with email to keep her photo.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
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
        GroupLine("Gender", genderLabel(saved.gender))
        GroupLine("Voice", "${saved.voiceLabel} voice")
        GroupLine("Memory", "$memoryCount things remembered")
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
                    onArchive()
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
        EditBody(saved, onBack, viewModel::saveCompanion)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun EditBody(
    saved: SavedCompanion,
    onBack: () -> Unit,
    onSave: (SavedCompanion, CompanionDraft) -> Unit,
) {
    var revision by remember { mutableIntStateOf(0) }
    var name by remember(saved.name, revision) { mutableStateOf(saved.name) }
    var traits by remember(saved.traits, revision) { mutableStateOf(saved.traits) }
    var warmth by remember(saved.empathyLevel, revision) { mutableFloatStateOf(saved.empathyLevel.toFloat()) }
    var humour by remember(saved.humorLevel, revision) { mutableFloatStateOf(saved.humorLevel.toFloat()) }
    var flirt by remember(saved.flirtLevel, revision) { mutableFloatStateOf(saved.flirtLevel.toFloat()) }
    var romance by remember(saved.romanceLevel, revision) { mutableFloatStateOf(saved.romanceLevel.toFloat()) }
    var gender by remember(saved.gender, revision) { mutableStateOf(companionGender(saved.gender)) }
    var relationship by remember(saved.relationship, revision) { mutableStateOf(saved.relationship) }
    var style by remember(saved.style, revision) { mutableStateOf(saved.style) }
    var hair by remember(saved.hairColor, revision) { mutableStateOf(saved.hairColor) }
    var eyes by remember(saved.eyeColor, revision) { mutableStateOf(saved.eyeColor) }
    var skin by remember(saved.skinTone, revision) { mutableStateOf(saved.skinTone) }
    var voiceLabel by remember(saved.voiceLabel, revision) { mutableStateOf(saved.voiceLabel) }
    val changes = listOf(
        name.trim() != saved.name,
        gender != companionGender(saved.gender),
        relationship != saved.relationship,
        style != saved.style,
        hair != saved.hairColor,
        eyes != saved.eyeColor,
        skin != saved.skinTone,
        voiceLabel != saved.voiceLabel,
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
                "Changing ${saved.name}'s personality affects how they talk from here on. Everything they already remember stays.",
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
            Text("Gender", style = MaterialTheme.typography.labelLarge)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("FEMALE" to "Woman", "MALE" to "Man", "OTHER" to "Non-binary").forEach { (code, label) ->
                    FilterChip(
                        selected = gender == code,
                        onClick = { gender = code },
                        label = { Text(label) },
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
            Text("Relationship", style = MaterialTheme.typography.labelLarge)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                relationshipOptions.forEach { option ->
                    FilterChip(
                        selected = relationship == option,
                        onClick = { relationship = option },
                        label = { Text(option) },
                    )
                }
            }
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
            Text("Look", style = MaterialTheme.typography.labelLarge)
            ChoiceChips(lookStyles, style) { style = it }
            Text("Hair", style = MaterialTheme.typography.labelLarge)
            ChoiceChips(hairColors, hair) { hair = it }
            Text("Eyes", style = MaterialTheme.typography.labelLarge)
            ChoiceChips(eyeColors, eyes) { eyes = it }
            Text("Skin", style = MaterialTheme.typography.labelLarge)
            ChoiceChips(skinTones, skin) { skin = it }
            Text("Voice", style = MaterialTheme.typography.labelLarge)
            ChoiceChips(voiceChoices.map { it.second }, voiceLabel) { voiceLabel = it }
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
                            style = style,
                            hairColor = hair,
                            eyeColor = eyes,
                            skinTone = skin,
                            traits = traits,
                            empathyLevel = warmth.toInt(),
                            humorLevel = humour.toInt(),
                            flirtLevel = flirt.toInt(),
                            romanceLevel = romance.toInt(),
                            voiceId = voiceIdFor(voiceLabel),
                            voiceLabel = voiceLabel,
                            relationship = relationship,
                            name = name.trim(),
                            gender = gender,
                        )
                        onSave(saved, draft)
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
    val viewModel = rememberSettingsViewModel()
    val messages by viewModel.messages.collectAsState()
    val plan by viewModel.planLabel.collectAsState()
    LaunchedEffect(Unit) { viewModel.refreshPlan() }
    val companion by viewModel.companion.collectAsState()
    val usage = monthUsage(
        messages.map { CountedMessage(it.role, it.createdAtEpochMs, it.durationMs) },
        System.currentTimeMillis(),
    )
    val name = companion?.name?.ifBlank { null } ?: "her"
    SubscriptionContent(name, usage, plan, onBack)
}

@Composable
private fun SubscriptionContent(
    name: String,
    usage: MonthUsage,
    plan: String,
    onBack: () -> Unit,
) {
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
            "This month on this phone. The server does not enforce a monthly limit, so chat stays open.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(12.dp))
        UsageMeter("Messages", usage.messages, FREE_MESSAGE_LIMIT)
        UsageMeter("Voice minutes", usage.voiceMinutes, FREE_VOICE_MINUTES)
        UsageMeter("Images", 0, FREE_IMAGE_LIMIT)
        Spacer(Modifier.height(12.dp))
        PaywallCard(name = name, resetLabel = resetLabel(usage.resetEpochMs))
        Spacer(Modifier.height(16.dp))
        PlanCard("Free", planCardStatus("Free", plan), listOf("100 messages", "10 voice minutes", "5 images"))
        PlanCard("Premium", planCardStatus("Premium", plan), listOf("Unlimited messages", "300 voice minutes", "100 images", "1,200 audio call minutes"))
        PlanCard(
            "Premium Plus",
            planCardStatus("Premium Plus", plan),
            listOf(
                "Unlimited messages",
                "1,000 voice minutes",
                "300 images",
                "1,200 audio call minutes",
                "1,200 video call minutes",
            ),
        )
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

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChoiceChips(options: List<String>, selected: String, onSelect: (String) -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { option ->
            FilterChip(
                selected = selected == option,
                onClick = { onSelect(option) },
                label = { Text(option) },
            )
        }
    }
}

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

@Preview(name = "You", showBackground = true, widthDp = 360, heightDp = 800)
@Composable
private fun YouSettingsPreview() {
    MyBaseTheme {
        YouSettingsContent(
            displayName = "Vipin",
            plan = "Free",
            nameMessage = null,
            email = "vipin@example.com",
            privacy = true,
            theme = "system",
            companionName = "Aria",
            onProfile = {},
            onPrivacy = {},
            onPlans = {},
            onLogout = {},
            onSaveName = {},
            onScreenPrivacy = {},
            onTheme = {},
            onDeleteAccount = {},
        )
    }
}

@Preview(name = "Companion profile", showBackground = true, widthDp = 360, heightDp = 800)
@Composable
private fun CompanionProfilePreview() {
    MyBaseTheme {
        CompanionProfileContent(
            saved = sampleCompanion(),
            memoryCount = sampleMemories().size,
            photoSaving = false,
            photoMessage = null,
            onBack = {},
            onEdit = {},
            onPickPhoto = {},
            onArchive = {},
        )
    }
}

@Preview(name = "Edit companion", showBackground = true, widthDp = 360, heightDp = 800)
@Composable
private fun EditCompanionPreview() {
    MyBaseTheme {
        EditBody(sampleCompanion(), onBack = {}, onSave = { _, _ -> })
    }
}

@Preview(name = "Plan", showBackground = true, widthDp = 360, heightDp = 800)
@Composable
private fun SubscriptionPreview() {
    val now = System.currentTimeMillis()
    MyBaseTheme {
        SubscriptionContent(
            name = "Aria",
            usage = monthUsage(
                listOf(CountedMessage("USER", now, 60_000)),
                now,
            ),
            plan = "Free",
            onBack = {},
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
