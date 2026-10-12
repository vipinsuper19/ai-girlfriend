package com.dhama.mybase.ui.test

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsPropertyReceiver
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.text
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.input.KeyboardType
import com.dhama.mybase.BuildConfig
import com.dhama.mybase.core.age.parseDateOfBirth

/**
 * Debug-only yyyy-MM-dd field. Maestro types a date here instead of driving the
 * Material picker. Release builds do not include the field.
 */
@Composable
fun DebugDobField(
    id: String,
    onDateOfBirthIso: (String) -> Unit,
) {
    if (!BuildConfig.DEBUG) return
    var draft by rememberSaveable { mutableStateOf("") }
    TextField(
        value = draft,
        onValueChange = { raw ->
            draft = raw
            val trimmed = raw.trim()
            when {
                trimmed.isEmpty() -> onDateOfBirthIso("")
                else -> parseDateOfBirth(trimmed)?.let { onDateOfBirthIso(it.toString()) }
            }
        },
        modifier = Modifier
            .fillMaxWidth()
            .testId(id),
        label = { Text("YYYY-MM-DD") },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
    )
}

/**
 * On debug builds, publish the formatted date as the field's accessibility text
 * so a test can read the value. Release builds keep the existing description.
 */
fun Modifier.debugDobValue(formatted: String): Modifier {
    if (!BuildConfig.DEBUG || formatted.isEmpty()) return this
    return semantics { dobValue(formatted) }
}

private fun SemanticsPropertyReceiver.dobValue(formatted: String) {
    text = AnnotatedString(formatted)
}
