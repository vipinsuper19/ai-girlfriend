package com.dhama.mybase.ui.gallery

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import coil.compose.AsyncImage
import com.dhama.mybase.core.data.GalleryImage
import com.dhama.mybase.core.network.IMAGE_PROMPT_MAX
import com.dhama.mybase.ui.theme.MyBaseTheme

@Composable
fun GalleryScreen(
    companionName: String,
    onBack: () -> Unit,
    viewModel: GalleryViewModel = hiltViewModel(),
) {
    val images by viewModel.images.collectAsState()
    val loading by viewModel.loading.collectAsState()
    val creating by viewModel.creating.collectAsState()
    val note by viewModel.note.collectAsState()
    GalleryContent(
        companionName = companionName,
        images = images,
        loading = loading,
        creating = creating,
        note = note,
        onBack = onBack,
        onCreate = viewModel::create,
        onDelete = viewModel::delete,
    )
}

@Composable
private fun GalleryContent(
    companionName: String,
    images: List<GalleryImage>,
    loading: Boolean,
    creating: Boolean,
    note: String?,
    onBack: () -> Unit,
    onCreate: (String) -> Unit,
    onDelete: (GalleryImage) -> Unit,
) {
    val name = companionName.ifBlank { "her" }
    var prompt by remember { mutableStateOf("") }
    var open by remember { mutableStateOf<GalleryImage?>(null) }
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                    Text(
                        "Photos of $name",
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier.semantics { heading() },
                    )
                }
                OutlinedTextField(
                    value = prompt,
                    onValueChange = { prompt = it.take(IMAGE_PROMPT_MAX) },
                    label = { Text("Where is she? What is she doing?") },
                    placeholder = { Text("Reading in a sunny café") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                )
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = { onCreate(prompt) },
                    enabled = !creating,
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                ) {
                    Text(if (creating) "Making her photo…" else "Make a photo")
                }
                if (creating || loading) {
                    Spacer(Modifier.height(8.dp))
                    LinearProgressIndicator(Modifier.fillMaxWidth())
                }
                if (!note.isNullOrBlank()) {
                    Spacer(Modifier.height(8.dp))
                    Text(note.orEmpty(), color = MaterialTheme.colorScheme.error)
                }
                if (!loading && images.isEmpty()) {
                    Spacer(Modifier.height(16.dp))
                    Text(
                        "Photos you make of $name show up here. Each one counts toward your monthly image allowance.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Spacer(Modifier.height(8.dp))
            }
        }
        items(images, key = { it.id }) { image ->
            AsyncImage(
                model = image.url,
                contentDescription = image.prompt.ifBlank { "Photo of $name" },
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .clip(RoundedCornerShape(16.dp))
                    .background(MaterialTheme.colorScheme.surfaceContainer)
                    .clickable { open = image },
            )
        }
    }
    open?.let { image ->
        AlertDialog(
            onDismissRequest = { open = null },
            text = {
                Column {
                    AsyncImage(
                        model = image.url,
                        contentDescription = image.prompt.ifBlank { "Photo of $name" },
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)),
                    )
                    if (image.prompt.isNotBlank()) {
                        Spacer(Modifier.height(8.dp))
                        Text(image.prompt, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { open = null }) { Text("Close") }
            },
            dismissButton = {
                TextButton(onClick = {
                    onDelete(image)
                    open = null
                }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
            },
        )
    }
}

@Preview(name = "Gallery", showBackground = true, widthDp = 360, heightDp = 800)
@Composable
private fun GalleryPreview() {
    MyBaseTheme {
        GalleryContent(
            companionName = "Aria",
            images = emptyList(),
            loading = false,
            creating = false,
            note = null,
            onBack = {},
            onCreate = {},
            onDelete = {},
        )
    }
}
