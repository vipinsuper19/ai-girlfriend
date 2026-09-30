package com.dhama.mybase.ui.usage

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.dhama.mybase.ui.theme.companionColors

@Composable
fun OfflineStrip(modifier: Modifier = Modifier) {
    Text(
        "You're offline. Chat, memories, and voice notes on this phone still work.",
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.companionColors.warningContainer)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        color = MaterialTheme.companionColors.onWarningContainer,
        style = MaterialTheme.typography.bodySmall,
    )
}

@Composable
fun UsageWarning(
    name: String,
    remaining: Int,
    resetLabel: String,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.companionColors.warningContainer)
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Text(
            "$remaining messages left with $name this month. Resets $resetLabel.",
            color = MaterialTheme.companionColors.onWarningContainer,
            style = MaterialTheme.typography.bodySmall,
        )
        TextButton(onClick = onDismiss) { Text("Dismiss") }
    }
}

@Composable
fun PaywallCard(
    name: String,
    resetLabel: String,
    onSeePlans: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceContainer)
            .padding(16.dp),
    ) {
        Text(
            "Your history and everything $name remembers stays exactly as it is.",
            style = MaterialTheme.typography.bodyLarge,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            "Free is 100 messages a month. That resets $resetLabel. There is no upgrade from here.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (onSeePlans != null) {
            TextButton(onClick = onSeePlans) { Text("See plans") }
        }
    }
}

@Composable
fun UsageMeter(label: String, used: Int, limit: Int?) {
    val fraction = when {
        limit == null || limit <= 0 -> 0f
        else -> (used.toFloat() / limit).coerceIn(0f, 1f)
    }
    val value = if (limit == null) "$used · unlimited" else "$used of $limit"
    Column(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Row(Modifier.fillMaxWidth()) {
            Text(label, modifier = Modifier.weight(1f))
            Text(value, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (limit != null) {
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
}
