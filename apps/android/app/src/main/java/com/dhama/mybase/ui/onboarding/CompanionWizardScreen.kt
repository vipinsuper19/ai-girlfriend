package com.dhama.mybase.ui.onboarding

import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.dhama.mybase.core.model.CompanionDraft

private val styles = listOf("Realistic", "Illustrated", "Anime")
private val hairColors = listOf("Black", "Brown", "Auburn", "Blonde", "Copper")
private val eyeColors = listOf("Brown", "Green", "Blue", "Hazel", "Grey")
private val skinTones = listOf("Fair", "Warm", "Olive", "Deep")
private val traits = listOf("Caring", "Playful", "Curious", "Calm", "Confident", "Witty", "Ambitious", "Creative")
private val voices = listOf(
    "soft" to ("Soft" to "Gentle, unhurried"),
    "warm" to ("Warm" to "Low and easy"),
    "bright" to ("Bright" to "Light, quick"),
    "calm" to ("Calm" to "Even, grounded"),
)
private val relationships = listOf("Girlfriend", "Partner", "Close friend", "Confidante")

@Composable
fun CompanionWizardScreen(
    onExit: () -> Unit,
    onCreated: () -> Unit,
    viewModel: CompanionWizardViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    LaunchedEffect(Unit) {
        viewModel.created.collect { onCreated() }
    }
    BackHandler(enabled = !state.creating) {
        if (!viewModel.back()) onExit()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp, vertical = 12.dp),
    ) {
        if (state.step == WizardStep.Intro) {
            IntroStep(onStart = viewModel::next)
        } else {
            StepHeader(
                step = state.step,
                showSkip = state.step != WizardStep.Finalize,
                onBack = { if (!viewModel.back()) onExit() },
                onSkip = viewModel::next,
            )
            Spacer(Modifier.height(8.dp))
            when (state.step) {
                WizardStep.Appearance -> AppearanceStep(state.draft, viewModel::update, viewModel::next)
                WizardStep.Personality -> PersonalityStep(state.draft, viewModel::update, viewModel::next)
                WizardStep.Voice -> VoiceStep(state.draft, viewModel::update, viewModel::next)
                WizardStep.Finalize -> FinalizeStep(
                    draft = state.draft,
                    creating = state.creating,
                    error = state.error,
                    nameError = state.nameError,
                    onName = { name -> viewModel.update { it.copy(name = name) } },
                    onCreate = viewModel::create,
                )
                WizardStep.Intro -> Unit
            }
        }
    }
}

@Composable
private fun IntroStep(onStart: () -> Unit) {
    Column(Modifier.fillMaxSize()) {
        Spacer(Modifier.weight(1f))
        Text(
            "Let's create\nher.",
            style = MaterialTheme.typography.displayMedium,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(Modifier.height(20.dp))
        Bullet("Her personality", "Warmth, humour, how forward she is — you set the dial.")
        Bullet("Her look", "A face and style that feel right to you.")
        Bullet("Her memory", "She keeps what matters. You can read and delete all of it.")
        Spacer(Modifier.weight(1f))
        PrimaryAction("Start", onStart)
        Text(
            "Takes about a minute. You can change everything later.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .padding(top = 12.dp)
                .align(Alignment.CenterHorizontally),
        )
    }
}

@Composable
private fun Bullet(title: String, body: String) {
    Row(Modifier.padding(bottom = 14.dp)) {
        Box(
            Modifier
                .padding(top = 7.dp)
                .size(6.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primary),
        )
        Spacer(Modifier.width(12.dp))
        Column {
            Text(title, style = MaterialTheme.typography.titleSmall)
            Text(body, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun StepHeader(
    step: WizardStep,
    showSkip: Boolean,
    onBack: () -> Unit,
    onSkip: () -> Unit,
) {
    val index = step.progressIndex()
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
            Text(
                "Step ${index} of 4",
                modifier = Modifier
                    .weight(1f)
                    .semantics { stateDescription = "Step $index of 4" },
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (showSkip) {
                TextButton(onClick = onSkip) { Text("Skip") }
            } else {
                Spacer(Modifier.width(48.dp))
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            repeat(4) { segment ->
                Box(
                    Modifier
                        .weight(1f)
                        .height(4.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(
                            if (segment < index) MaterialTheme.colorScheme.primary
                            else MaterialTheme.colorScheme.surfaceContainerHigh,
                        ),
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
private fun AppearanceStep(
    draft: CompanionDraft,
    onChange: ((CompanionDraft) -> CompanionDraft) -> Unit,
    onContinue: () -> Unit,
) {
    var more by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState()),
        ) {
            Text("How should she look?", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.semantics { heading() })
            Spacer(Modifier.height(16.dp))
            Monogram(draft.name.ifBlank { draft.style }.take(1), Modifier.align(Alignment.CenterHorizontally))
            SectionLabel("STYLE")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                styles.forEach { style ->
                    FilterChip(
                        selected = draft.style == style,
                        onClick = { onChange { it.copy(style = style) } },
                        label = { Text(style) },
                    )
                }
            }
            SectionLabel("HAIR")
            ChoiceRow(hairColors, draft.hairColor) { color -> onChange { it.copy(hairColor = color) } }
            SectionLabel("EYES")
            ChoiceRow(eyeColors, draft.eyeColor) { color -> onChange { it.copy(eyeColor = color) } }
            SectionLabel("SKIN")
            ChoiceRow(skinTones, draft.skinTone) { tone -> onChange { it.copy(skinTone = tone) } }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = { more = true }, modifier = Modifier.fillMaxWidth()) {
                Text("Skin tone, build, height, clothing")
            }
        }
        PrimaryAction("Continue", onContinue)
    }
    if (more) {
        ModalBottomSheet(onDismissRequest = { more = false }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
            Column(Modifier.padding(horizontal = 20.dp, vertical = 8.dp)) {
                Text("More about her look", style = MaterialTheme.typography.titleLarge)
                MoreField("Ethnicity", draft.ethnicity.orEmpty()) { value -> onChange { it.copy(ethnicity = value.ifBlank { null }) } }
                MoreField("Build", draft.bodyType.orEmpty()) { value -> onChange { it.copy(bodyType = value.ifBlank { null }) } }
                MoreField("Height", draft.height.orEmpty()) { value -> onChange { it.copy(height = value.ifBlank { null }) } }
                MoreField("Clothing", draft.clothingStyle.orEmpty()) { value -> onChange { it.copy(clothingStyle = value.ifBlank { null }) } }
                MoreField("Hair style", draft.hairStyle.orEmpty()) { value -> onChange { it.copy(hairStyle = value.ifBlank { null }) } }
                Spacer(Modifier.height(12.dp))
                PrimaryAction("Done") { more = false }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun MoreField(label: String, value: String, onValue: (String) -> Unit) {
    TextField(
        value = value,
        onValueChange = onValue,
        label = { Text(label) },
        singleLine = true,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = MaterialTheme.colorScheme.surfaceContainerLow,
            unfocusedContainerColor = MaterialTheme.colorScheme.surfaceContainerLow,
        ),
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PersonalityStep(
    draft: CompanionDraft,
    onChange: ((CompanionDraft) -> CompanionDraft) -> Unit,
    onContinue: () -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState()),
        ) {
            Text("Who is she?", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.semantics { heading() })
            Text(
                "Pick up to four. These shape how she talks, not just what she says.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(12.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                traits.forEach { trait ->
                    FilterChip(
                        selected = trait in draft.traits,
                        onClick = { onChange { it.toggleTrait(trait) } },
                        label = { Text(trait) },
                        leadingIcon = if (trait in draft.traits) {
                            { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp)) }
                        } else {
                            null
                        },
                    )
                }
            }
            SectionLabel("HOW SHE COMES ACROSS")
            LevelSlider("Warmth", draft.empathyLevel) { value -> onChange { it.copy(empathyLevel = value) } }
            LevelSlider("Humour", draft.humorLevel) { value -> onChange { it.copy(humorLevel = value) } }
            LevelSlider("Flirtiness", draft.flirtLevel) { value -> onChange { it.copy(flirtLevel = value) } }
            LevelSlider("Romance", draft.romanceLevel) { value -> onChange { it.copy(romanceLevel = value) } }
        }
        PrimaryAction("Continue", onContinue)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun VoiceStep(
    draft: CompanionDraft,
    onChange: ((CompanionDraft) -> CompanionDraft) -> Unit,
    onContinue: () -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState()),
        ) {
            Text("How does she sound?", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.semantics { heading() })
            Spacer(Modifier.height(12.dp))
            voices.forEach { (id, copy) ->
                val selected = draft.voiceId == id
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(if (selected) MaterialTheme.colorScheme.primaryContainer else Color.Transparent)
                        .border(
                            1.dp,
                            if (selected) Color.Transparent else MaterialTheme.colorScheme.outlineVariant,
                            RoundedCornerShape(16.dp),
                        )
                        .clickable { onChange { it.copy(voiceId = id, voiceLabel = copy.first) } }
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(copy.first, fontWeight = FontWeight.SemiBold, color = if (selected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface)
                        Text(copy.second, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            SectionLabel("WHAT IS SHE TO YOU?")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                relationships.forEach { relation ->
                    FilterChip(
                        selected = draft.relationship == relation,
                        onClick = { onChange { it.copy(relationship = relation) } },
                        label = { Text(relation) },
                    )
                }
            }
        }
        PrimaryAction("Continue", onContinue)
    }
}

@Composable
private fun FinalizeStep(
    draft: CompanionDraft,
    creating: Boolean,
    error: String?,
    nameError: String?,
    onName: (String) -> Unit,
    onCreate: () -> Unit,
) {
    val display = draft.normalizedName().ifBlank { "her" }
    Column(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (error != null) {
                Text(
                    error,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(MaterialTheme.colorScheme.errorContainer)
                        .padding(12.dp),
                )
                Spacer(Modifier.height(16.dp))
            }
            Monogram(draft.normalizedName().ifBlank { "A" }.take(1))
            Spacer(Modifier.height(12.dp))
            Text(draft.traits.joinToString(" · ").ifBlank { "Your choices" }, style = MaterialTheme.typography.bodyMedium)
            Text(
                "${draft.voiceLabel} voice · ${draft.relationship}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(20.dp))
            TextField(
                value = draft.name,
                onValueChange = onName,
                label = { Text("Her name") },
                singleLine = true,
                isError = nameError != null,
                supportingText = nameError?.let { { Text(it) } },
                modifier = Modifier.fillMaxWidth(),
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = MaterialTheme.colorScheme.surfaceContainerLow,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surfaceContainerLow,
                ),
            )
        }
        PrimaryAction(
            label = if (creating) "Creating…" else "Meet $display",
            onClick = onCreate,
            loading = creating,
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChoiceRow(options: List<String>, selected: String, onSelect: (String) -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { option ->
            val on = option == selected
            Text(
                option,
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(if (on) MaterialTheme.colorScheme.secondaryContainer else Color.Transparent)
                    .border(
                        1.dp,
                        if (on) Color.Transparent else MaterialTheme.colorScheme.outlineVariant,
                        RoundedCornerShape(10.dp),
                    )
                    .clickable { onSelect(option) }
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                style = MaterialTheme.typography.labelMedium,
                color = if (on) MaterialTheme.colorScheme.onSecondaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun LevelSlider(label: String, value: Int, onChange: (Int) -> Unit) {
    Column(Modifier.padding(bottom = 8.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, style = MaterialTheme.typography.bodyMedium)
            Text(value.toString(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Slider(
            value = value.toFloat(),
            onValueChange = { onChange(it.toInt()) },
            valueRange = 0f..100f,
        )
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 16.dp, bottom = 8.dp),
    )
}

@Composable
private fun Monogram(letter: String, modifier: Modifier = Modifier) {
    Box(
        modifier
            .size(104.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.primaryContainer)
            .border(2.dp, MaterialTheme.colorScheme.primary, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            letter.uppercase(),
            style = MaterialTheme.typography.displayMedium,
            color = MaterialTheme.colorScheme.onPrimaryContainer,
        )
    }
}

@Composable
private fun PrimaryAction(label: String, onClick: () -> Unit, loading: Boolean = false) {
    Button(
        onClick = onClick,
        enabled = !loading,
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp),
        shape = RoundedCornerShape(28.dp),
        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
    ) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(18.dp),
                strokeWidth = 2.dp,
                color = MaterialTheme.colorScheme.onPrimary,
            )
            Spacer(Modifier.width(8.dp))
        }
        Text(label)
    }
}
