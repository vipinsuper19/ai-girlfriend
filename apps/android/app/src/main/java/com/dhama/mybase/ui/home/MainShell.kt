package com.dhama.mybase.ui.home

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.dhama.mybase.core.home.homeGreeting
import com.dhama.mybase.core.home.presenceLine
import com.dhama.mybase.core.memory.MemoryHighlight
import com.dhama.mybase.core.memory.highlightLine
import com.dhama.mybase.core.model.SavedCompanion
import com.dhama.mybase.core.usage.PlanUsage
import com.dhama.mybase.core.usage.UsageLevel
import com.dhama.mybase.core.usage.resetLabel
import com.dhama.mybase.core.usage.usageLevel
import com.dhama.mybase.ui.companion.CompanionPortrait
import com.dhama.mybase.ui.usage.OfflineStrip
import com.dhama.mybase.ui.usage.UsageWarning
import com.dhama.mybase.ui.chat.ChatScreen
import com.dhama.mybase.ui.chat.ConversationHistoryScreen
import com.dhama.mybase.ui.memory.MemoryDetailScreen
import com.dhama.mybase.ui.memory.MemoryListScreen
import com.dhama.mybase.ui.memory.MemoryPrivacyScreen
import com.dhama.mybase.ui.memory.MemoryViewModel
import com.dhama.mybase.ui.gallery.GalleryScreen
import com.dhama.mybase.ui.settings.CompanionProfileScreen
import com.dhama.mybase.ui.settings.EditCompanionScreen
import com.dhama.mybase.ui.settings.SubscriptionScreen
import com.dhama.mybase.ui.settings.YouSettingsScreen
import com.dhama.mybase.ui.settings.rememberSettingsViewModel
import com.dhama.mybase.ui.preview.sampleCompanion
import com.dhama.mybase.ui.theme.MyBaseTheme
import com.dhama.mybase.ui.theme.companionColors
import kotlinx.coroutines.launch
import java.util.Calendar

private enum class MainTab(val label: String, val icon: ImageVector) {
    Home("Home", Icons.Default.Home),
    Chat("Chat", Icons.AutoMirrored.Filled.Chat),
    Memory("Memory", Icons.Default.Bookmark),
    You("You", Icons.Default.Person),
}

@Composable
fun MainShell(
    onLoggedOut: () -> Unit,
    onArchived: () -> Unit,
    viewModel: CompanionHomeViewModel = hiltViewModel(),
) {
    val companion by viewModel.companion.collectAsState()
    val highlight by viewModel.memoryHighlight.collectAsState()
    val hasTalked by viewModel.hasTalked.collectAsState()
    val lastReply by viewModel.lastReply.collectAsState()
    val usage by viewModel.usage.collectAsState()
    val warningDismissed by viewModel.warningDismissedPeriod.collectAsState()
    val planLabel by viewModel.planLabel.collectAsState()
    val displayName by viewModel.displayName.collectAsState()
    val settings = rememberSettingsViewModel()
    val memoryViewModel: MemoryViewModel = hiltViewModel()
    val pendingDelete by memoryViewModel.pendingDelete.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    var tab by rememberSaveable { mutableIntStateOf(MainTab.Home.ordinal) }
    var screen by rememberSaveable { mutableStateOf("tabs") }
    var memoryId by rememberSaveable { mutableStateOf("") }

    LaunchedEffect(Unit) {
        scope.launch { viewModel.loggedOut.collect { onLoggedOut() } }
        scope.launch { settings.archived.collect { onArchived() } }
        scope.launch { settings.accountDeleted.collect { onLoggedOut() } }
        scope.launch {
            settings.archiveFailed.collect { message ->
                snackbarHostState.showSnackbar(message)
            }
        }
    }
    LaunchedEffect(pendingDelete?.id) {
        val current = pendingDelete ?: return@LaunchedEffect
        val result = snackbarHostState.showSnackbar(
            message = "Forgotten",
            actionLabel = "Undo",
            duration = SnackbarDuration.Short,
        )
        if (result == SnackbarResult.ActionPerformed && memoryViewModel.pendingDelete.value?.id == current.id) {
            memoryViewModel.undoDelete()
        }
    }
    BackHandler(enabled = screen != "tabs") {
        screen = if (screen == "edit") "profile" else "tabs"
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            if (screen == "tabs") {
                NavigationBar(containerColor = MaterialTheme.colorScheme.surfaceContainer) {
                    MainTab.entries.forEach { item ->
                        NavigationBarItem(
                            selected = tab == item.ordinal,
                            onClick = { tab = item.ordinal },
                            icon = { Icon(item.icon, contentDescription = item.label) },
                            label = { Text(item.label) },
                        )
                    }
                }
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when (screen) {
                "memory" -> MemoryDetailScreen(memoryId, onBack = { screen = "tabs" }, viewModel = memoryViewModel)
                "privacy" -> MemoryPrivacyScreen(companion?.name.orEmpty(), onBack = { screen = "tabs" })
                "profile" -> CompanionProfileScreen(onBack = { screen = "tabs" }, onEdit = { screen = "edit" })
                "edit" -> EditCompanionScreen(onBack = { screen = "profile" })
                "plans" -> SubscriptionScreen(onBack = { screen = "tabs" })
                "gallery" -> GalleryScreen(companion?.name.orEmpty(), onBack = { screen = "tabs" })
                "history" -> ConversationHistoryScreen(
                    onBack = { screen = "tabs" },
                    onOpened = {
                        tab = MainTab.Chat.ordinal
                        screen = "tabs"
                    },
                )
                else -> when (MainTab.entries[tab]) {
                    MainTab.Home -> HomeTab(
                        companion = companion,
                        highlight = highlight,
                        hasTalked = hasTalked,
                        lastReply = lastReply,
                        usage = usage,
                        warningDismissed = warningDismissed,
                        planLabel = planLabel,
                        displayName = displayName,
                        onDismissWarning = {
                            usage?.periodStartEpochMs?.let(viewModel::dismissUsageWarning)
                        },
                        onTalk = { tab = MainTab.Chat.ordinal },
                        onMemories = { tab = MainTab.Memory.ordinal },
                        onProfile = { screen = "profile" },
                        onSettings = { tab = MainTab.You.ordinal },
                        onPhotos = { screen = "gallery" },
                    )
                    MainTab.Chat -> ChatScreen(
                        onSeePlans = { screen = "plans" },
                        onHistory = { screen = "history" },
                    )
                    MainTab.Memory -> MemoryListScreen(
                        companionName = companion?.name.orEmpty(),
                        onOpen = {
                            memoryId = it
                            screen = "memory"
                        },
                        viewModel = memoryViewModel,
                    )
                    MainTab.You -> YouSettingsScreen(
                        onProfile = { screen = "profile" },
                        onPrivacy = { screen = "privacy" },
                        onPlans = { screen = "plans" },
                        onLogout = viewModel::logout,
                    )
                }
            }
        }
    }
}

@Composable
private fun HomeTab(
    companion: SavedCompanion?,
    highlight: MemoryHighlight?,
    hasTalked: Boolean,
    lastReply: String?,
    usage: PlanUsage?,
    warningDismissed: String,
    planLabel: String,
    displayName: String,
    onDismissWarning: () -> Unit,
    onTalk: () -> Unit,
    onMemories: () -> Unit,
    onProfile: () -> Unit,
    onSettings: () -> Unit,
    onPhotos: () -> Unit = {},
) {
    if (companion == null) {
        Column(Modifier.fillMaxSize().padding(horizontal = 20.dp), verticalArrangement = Arrangement.Center) {
            Text("Loading her…", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        return
    }
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                homeGreeting(Calendar.getInstance().get(Calendar.HOUR_OF_DAY), displayName),
                modifier = Modifier.weight(1f),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (planLabel.isNotBlank()) {
                Text(
                    planLabel,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = onSettings) {
                Icon(Icons.Default.Settings, contentDescription = "Settings")
            }
        }
        if (companion.conversationId == null) {
            Spacer(Modifier.height(8.dp))
            OfflineStrip()
        }
        Spacer(Modifier.height(12.dp))
        CompanionPortrait(companion.name, companion.avatarUrl, 128.dp)
        Text(
            companion.name,
            style = MaterialTheme.typography.displayMedium,
            modifier = Modifier
                .padding(top = 12.dp)
                .semantics { heading() },
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(7.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.companionColors.onlineIndicator)
                    .clearAndSetSemantics {},
            )
            Text(
                "  ${presenceLine(companion.conversationId != null)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Spacer(Modifier.height(20.dp))
        Text(
            lastReply?.takeIf { it.isNotBlank() } ?: companion.greeting,
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp, bottomEnd = 20.dp, bottomStart = 6.dp))
                .background(MaterialTheme.companionColors.bubbleIncoming)
                .padding(16.dp),
            color = MaterialTheme.companionColors.onBubbleIncoming,
        )
        Spacer(Modifier.height(16.dp))
        Button(
            onClick = onTalk,
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp),
            shape = RoundedCornerShape(28.dp),
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
        ) {
            Text(if (hasTalked) "Continue talking" else "Say hello")
        }
        val messageLimit = usage?.messagesLimit
        val nearLimit = usage != null &&
            messageLimit != null &&
            usageLevel(usage.messagesUsed, messageLimit) == UsageLevel.NEARING &&
            warningDismissed != usage.periodStartEpochMs.toString()
        if (nearLimit && usage != null && messageLimit != null) {
            Spacer(Modifier.height(12.dp))
            UsageWarning(
                name = companion.name,
                remaining = (messageLimit - usage.messagesUsed).coerceAtLeast(0),
                resetLabel = resetLabel(usage.resetEpochMs),
                onDismiss = onDismissWarning,
            )
        }
        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            QuickAction("Talk", onTalk, Modifier.weight(1f))
            QuickAction("Memories", onMemories, Modifier.weight(1f))
            QuickAction("Profile", onProfile, Modifier.weight(1f))
            if (companion.conversationId != null) {
                QuickAction("Photos", onPhotos, Modifier.weight(1f))
            }
        }
        if (highlight != null) {
            Spacer(Modifier.height(16.dp))
            Text(
                highlightLine(highlight),
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(MaterialTheme.colorScheme.tertiaryContainer)
                    .clickable(onClick = onMemories)
                    .padding(16.dp),
                color = MaterialTheme.colorScheme.onTertiaryContainer,
            )
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun QuickAction(label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    TextButton(
        onClick = onClick,
        modifier = modifier.heightIn(min = 48.dp),
    ) { Text(label) }
}

@Preview(name = "Home", showBackground = true, widthDp = 360, heightDp = 800)
@Composable
private fun HomeTabPreview() {
    MyBaseTheme {
        Scaffold(
            bottomBar = {
                NavigationBar(containerColor = MaterialTheme.colorScheme.surfaceContainer) {
                    MainTab.entries.forEach { item ->
                        NavigationBarItem(
                            selected = item == MainTab.Home,
                            onClick = {},
                            icon = { Icon(item.icon, contentDescription = item.label) },
                            label = { Text(item.label) },
                        )
                    }
                }
            },
        ) { padding ->
            Box(Modifier.fillMaxSize().padding(padding)) {
                HomeTab(
                    companion = sampleCompanion(),
                    highlight = MemoryHighlight("You mentioned your sister", thisWeek = true),
                    hasTalked = true,
                    lastReply = "Tell me about her. I'm right here.",
                    usage = PlanUsage(
                        messagesUsed = 12,
                        messagesLimit = 100,
                        voiceUsed = 1,
                        voiceLimit = 10,
                        imagesUsed = 0,
                        imagesLimit = 5,
                        periodStartEpochMs = 1_735_689_600_000L,
                        resetEpochMs = 1_738_368_000_000L,
                        fromServer = true,
                    ),
                    warningDismissed = "",
                    planLabel = "Free",
                    displayName = "Vipin",
                    onDismissWarning = {},
                    onTalk = {},
                    onMemories = {},
                    onProfile = {},
                    onSettings = {},
                )
            }
        }
    }
}

