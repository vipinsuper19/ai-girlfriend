package com.dhama.mybase.ui.test

import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId

/**
 * Exposes [id] as a resource id for Maestro and UI Automator.
 * Compose test tags stay invisible and do not change layout.
 */
fun Modifier.testId(id: String): Modifier = this
    .semantics { testTagsAsResourceId = true }
    .testTag(id)
