package com.dhama.mybase.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.dhama.mybase.core.network.RemoteConversation
import com.dhama.mybase.core.network.conversationPreview
import com.dhama.mybase.core.network.conversationTitle
import com.dhama.mybase.core.network.epochMillis
import com.dhama.mybase.core.network.relativeChatTime
import com.dhama.mybase.ui.companion.CompanionPortrait
import com.dhama.mybase.ui.preview.sampleCompanion
import com.dhama.mybase.ui.preview.sampleConversations
import com.dhama.mybase.ui.theme.MyBaseTheme

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConversationHistoryScreen(
    onBack: () -> Unit,
    onOpened: () -> Unit,
    viewModel: ConversationHistoryViewModel = hiltViewModel(),
) {
    val conversations by viewModel.conversations.collectAsState()
    val hidden by viewModel.hiddenIds.collectAsState()
    val companion by viewModel.companion.collectAsState()
    val loading by viewModel.loading.collectAsState()
    val busy by viewModel.busy.collectAsState()
    val error by viewModel.error.collectAsState()
    val pending by viewModel.pendingDelete.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val visible = conversations.filter { it.id !in hidden }
    val name = companion?.name.orEmpty()

    LaunchedEffect(Unit) { viewModel.refresh() }
    LaunchedEffect(pending?.id) {
        val current = pending ?: return@LaunchedEffect
        val result = snackbarHostState.showSnackbar(
            message = "Conversation removed",
            actionLabel = "Undo",
            duration = SnackbarDuration.Short,
        )
        if (result == SnackbarResult.ActionPerformed && viewModel.pendingDelete.value?.id == current.id) {
            viewModel.undoDelete()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            Button(
                onClick = { viewModel.start(onOpened) },
                enabled = !busy,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp)
                    .heightIn(min = 56.dp),
            ) { Text("Start a new conversation") }
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 8.dp)) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                }
                Text(
                    "History",
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.semantics { heading() },
                )
            }
            if (!error.isNullOrBlank()) {
                Text(
                    error.orEmpty(),
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
                )
            }
            if (loading && visible.isEmpty()) {
                Text(
                    "Loading conversations…",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
                )
            }
            LazyColumn(Modifier.fillMaxSize()) {
                items(visible, key = { it.id }) { conversation ->
                    ConversationRow(
                        conversation = conversation,
                        companionName = name,
                        avatarUrl = companion?.avatarUrl.orEmpty(),
                        active = conversation.id == companion?.conversationId,
                        onOpen = { viewModel.open(conversation.id, onOpened) },
                        onDelete = { viewModel.stageDelete(conversation) },
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ConversationRow(
    conversation: RemoteConversation,
    companionName: String,
    avatarUrl: String,
    active: Boolean,
    onOpen: () -> Unit,
    onDelete: () -> Unit,
) {
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            if (value == SwipeToDismissBoxValue.EndToStart) {
                onDelete()
                true
            } else {
                false
            }
        },
    )
    val title = conversationTitle(conversation.title, companionName)
    val preview = conversationPreview(conversation.lastMessage)
    val whenLabel = relativeChatTime(epochMillis(conversation.lastMessageAt), System.currentTimeMillis())
    SwipeToDismissBox(
        state = dismissState,
        enableDismissFromStartToEnd = false,
        backgroundContent = {
            Box(
                Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.errorContainer)
                    .padding(horizontal = 20.dp),
                contentAlignment = Alignment.CenterEnd,
            ) {
                Text("Delete", color = MaterialTheme.colorScheme.onErrorContainer)
            }
        },
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 72.dp)
                .background(
                    if (active) MaterialTheme.colorScheme.surfaceContainerLow
                    else MaterialTheme.colorScheme.surface,
                )
                .clickable(onClick = onOpen)
                .padding(horizontal = 20.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            CompanionPortrait(companionName, avatarUrl, 40.dp)
            Column(Modifier.weight(1f)) {
                Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (preview.isNotEmpty()) {
                    Text(
                        preview,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            if (whenLabel.isNotBlank()) {
                Text(
                    whenLabel,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Preview(name = "History", showBackground = true, widthDp = 360, heightDp = 800)
@Composable
private fun ConversationHistoryPreview() {
    val companion = sampleCompanion()
    MyBaseTheme {
        Scaffold(
            bottomBar = {
                Button(
                    onClick = {},
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 12.dp)
                        .heightIn(min = 56.dp),
                ) { Text("Start a new conversation") }
            },
        ) { padding ->
            Column(Modifier.fillMaxSize().padding(padding)) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 8.dp)) {
                    IconButton(onClick = {}) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                    Text("History", style = MaterialTheme.typography.titleLarge, modifier = Modifier.semantics { heading() })
                }
                LazyColumn(Modifier.fillMaxSize()) {
                    items(sampleConversations(), key = { it.id }) { conversation ->
                        ConversationRow(
                            conversation = conversation,
                            companionName = companion.name,
                            avatarUrl = "",
                            active = conversation.id == companion.conversationId,
                            onOpen = {},
                            onDelete = {},
                        )
                    }
                }
            }
        }
    }
}
