package com.dhama.mybase.ui.screen

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen() {
    val sampleNotes = generateSampleNotes(20)

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("My Notes") })
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(sampleNotes) { note ->
                NoteCard(note = note)
            }
        }
    }
}

@Composable
fun NoteCard(note: NoteUiState) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = note.title,
                style = MaterialTheme.typography.headlineSmall
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = note.desc,
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

fun generateSampleNotes(count: Int): List<NoteUiState> {
    return (1..count).map {
        NoteUiState(
            id = 0,
            title = "Note Title $it",
            desc = "This is the description for note number $it. It can be a bit longer to demonstrate multi-line text."
        )
    }
}

@Preview(showBackground = true)
@Composable
fun PreviewHomeScreen() {
    HomeScreen()
}