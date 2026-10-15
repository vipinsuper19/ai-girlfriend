package com.dhama.mybase.ui.screen

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.collectAsState
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.dhama.mybase.core.age.AgeGateCopy
import com.dhama.mybase.core.age.evaluateAgeGate
import com.dhama.mybase.core.age.formatDateOfBirth
import com.dhama.mybase.core.age.parseDateOfBirth
import com.dhama.mybase.ui.component.MyButton
import com.dhama.mybase.ui.screen.vm.AgeConfirmViewModel
import com.dhama.mybase.ui.test.DebugDobField
import com.dhama.mybase.ui.test.debugDobValue
import com.dhama.mybase.ui.test.testId
import java.time.LocalDate

@Composable
fun AgeConfirmScreen(
    onConfirmed: () -> Unit,
    onSignOut: () -> Unit,
    viewModel: AgeConfirmViewModel = hiltViewModel(),
) {
    val storedDate by viewModel.storedDateOfBirth.collectAsState()
    val saving by viewModel.saving.collectAsState()
    val confirmed by viewModel.confirmed.collectAsState()
    LaunchedEffect(confirmed) {
        if (confirmed) onConfirmed()
    }
    AgeConfirmContent(
        storedDateOfBirth = storedDate,
        saving = saving,
        onConfirm = viewModel::confirm,
        onSignOut = { viewModel.signOut(onSignOut) },
    )
}

@Composable
fun AgeConfirmContent(
    storedDateOfBirth: String,
    saving: Boolean,
    onConfirm: (String) -> Unit,
    onSignOut: () -> Unit,
) {
    var dateOfBirthIso by rememberSaveable { mutableStateOf("") }
    var confirmedAdult by rememberSaveable { mutableStateOf(false) }
    var showDatePicker by rememberSaveable { mutableStateOf(false) }
    var attempted by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(storedDateOfBirth) {
        if (dateOfBirthIso.isEmpty() && storedDateOfBirth.isNotBlank()) {
            dateOfBirthIso = storedDateOfBirth
        }
    }
    val dateOfBirth = parseDateOfBirth(dateOfBirthIso)
    val decision = evaluateAgeGate(confirmedAdult, dateOfBirth, LocalDate.now())
    val dobMessage = when (decision.dateOfBirthMessage) {
        null -> null
        AgeGateCopy.UNDER_AGE -> AgeGateCopy.BLOCKED
        else -> decision.dateOfBirthMessage
    }?.takeIf { dateOfBirth != null || attempted }
    val confirmMessage = decision.confirmationMessage?.takeIf { attempted }

    Scaffold { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .imePadding()
                .systemBarsPadding()
                .padding(horizontal = 24.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            Spacer(Modifier.height(32.dp))
            Text(
                text = "Confirm your age",
                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                modifier = Modifier.testId("age_title"),
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = "This app is for adults. Enter your date of birth and confirm you are 18 or older before you continue.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(32.dp))
            Box(Modifier.fillMaxWidth()) {
                TextField(
                    value = dateOfBirth?.let(::formatDateOfBirth).orEmpty(),
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Date of birth") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    isError = dobMessage != null,
                    supportingText = {
                        if (dobMessage != null) {
                            Text(
                                text = dobMessage,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error,
                                modifier = Modifier.testId("age_error"),
                            )
                        }
                    },
                    colors = TextFieldDefaults.colors(
                        focusedIndicatorColor = MaterialTheme.colorScheme.primary,
                        unfocusedIndicatorColor = Color.LightGray,
                        focusedContainerColor = Color.Transparent,
                        unfocusedContainerColor = Color.Transparent,
                    ),
                )
                Box(
                    Modifier
                        .matchParentSize()
                        .testId("age_dob")
                        .debugDobValue(dateOfBirth?.let(::formatDateOfBirth).orEmpty())
                        .clickable { showDatePicker = true }
                        .semantics { contentDescription = "Date of birth" },
                )
            }
            DebugDobField(
                id = "age_dob_iso",
                onDateOfBirthIso = { dateOfBirthIso = it },
            )
            Spacer(Modifier.height(8.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .testId("age_adult")
                    .toggleable(
                        value = confirmedAdult,
                        role = Role.Checkbox,
                        onValueChange = { confirmedAdult = it },
                    ),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Checkbox(checked = confirmedAdult, onCheckedChange = null)
                Text(AgeGateCopy.CHECKBOX, style = MaterialTheme.typography.bodyLarge)
            }
            if (confirmMessage != null) {
                Text(
                    text = confirmMessage,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(start = 12.dp),
                )
            }
            Spacer(Modifier.height(32.dp))
            MyButton(
                loading = saving,
                text = "Continue",
                textLoading = "Saving...",
                modifier = Modifier.testId("age_continue"),
            ) {
                attempted = true
                val birth = parseDateOfBirth(dateOfBirthIso)
                val gate = evaluateAgeGate(confirmedAdult, birth, LocalDate.now())
                if (gate.allowed && birth != null) onConfirm(birth.toString())
            }
            Spacer(Modifier.height(16.dp))
            TextButton(
                onClick = onSignOut,
                modifier = Modifier
                    .fillMaxWidth()
                    .testId("age_sign_out"),
            ) {
                Text("Sign out")
            }
        }
    }

    if (showDatePicker) {
        DobDatePickerDialog(
            initialDate = dateOfBirth,
            onDismiss = { showDatePicker = false },
            onDateCommitted = { iso ->
                dateOfBirthIso = iso
                showDatePicker = false
            },
        )
    }
}
