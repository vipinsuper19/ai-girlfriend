package com.dhama.mybase.ui.screen

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDefaults
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DisplayMode
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.text.input.TransformedText
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.dhama.mybase.core.age.DobCommit
import com.dhama.mybase.core.age.MINIMUM_SIGNUP_AGE
import com.dhama.mybase.core.age.commitSelectedDob
import com.dhama.mybase.core.age.commitTypedDob
import com.dhama.mybase.core.age.dateOfBirthFromUtcMillis
import com.dhama.mybase.core.age.dobDigits
import com.dhama.mybase.core.age.dobInputPattern
import com.dhama.mybase.core.age.dobYearRange
import com.dhama.mybase.core.age.parseDobDigits
import com.dhama.mybase.core.age.utcMillisFromDateOfBirth
import kotlinx.coroutines.delay
import java.time.LocalDate
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DobDatePickerDialog(
    initialDate: LocalDate?,
    onDismiss: () -> Unit,
    onDateCommitted: (isoDate: String) -> Unit,
) {
    val today = LocalDate.now()
    val yearRange = dobYearRange(today)
    val pattern = dobInputPattern(Locale.getDefault(Locale.Category.FORMAT))
    var inputMode by rememberSaveable { mutableStateOf(false) }
    var digits by rememberSaveable {
        mutableStateOf(initialDate?.let { dobDigits(it, pattern) }.orEmpty())
    }
    val pickerState = rememberDatePickerState(
        initialSelectedDateMillis = initialDate?.let(::utcMillisFromDateOfBirth),
        initialDisplayedMonthMillis = utcMillisFromDateOfBirth(
            initialDate ?: today.minusYears(MINIMUM_SIGNUP_AGE.toLong()),
        ),
        yearRange = yearRange,
    )
    val commit = if (inputMode) {
        commitTypedDob(digits, pattern, today, yearRange)
    } else {
        commitSelectedDob(pickerState.selectedDateMillis, today, yearRange)
    }
    val accept = accept@{
        val accepted = commit as? DobCommit.Accepted ?: return@accept
        onDateCommitted(accepted.isoDate)
    }
    val toggleMode = {
        if (inputMode) {
            parseDobDigits(digits, pattern)?.let { date ->
                if (date.year in yearRange) {
                    pickerState.selectedDateMillis = utcMillisFromDateOfBirth(date)
                    pickerState.displayedMonthMillis = utcMillisFromDateOfBirth(date.withDayOfMonth(1))
                }
            }
            inputMode = false
        } else {
            pickerState.selectedDateMillis?.let { millis ->
                digits = dobDigits(dateOfBirthFromUtcMillis(millis), pattern)
            }
            inputMode = true
        }
    }

    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = accept, enabled = commit is DobCommit.Accepted) { Text("OK") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    ) {
        if (inputMode) {
            DobDateInputContent(
                digits = digits,
                onDigitsChange = { digits = it },
                pattern = pattern,
                errorMessage = (commit as? DobCommit.Rejected)?.message,
                onToggleMode = toggleMode,
                onDone = accept,
            )
        } else {
            val message = (commit as? DobCommit.Rejected)?.message
            DatePicker(
                state = pickerState,
                showModeToggle = false,
                title = { DobPickerModeTitle(inputMode = false, onToggle = toggleMode) },
                headline = {
                    if (message != null) {
                        Text(
                            text = message,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(start = 24.dp, end = 12.dp, bottom = 12.dp),
                        )
                    } else {
                        DatePickerDefaults.DatePickerHeadline(
                            selectedDateMillis = pickerState.selectedDateMillis,
                            displayMode = DisplayMode.Picker,
                            dateFormatter = remember { DatePickerDefaults.dateFormatter() },
                            modifier = Modifier.padding(start = 24.dp, end = 12.dp, bottom = 12.dp),
                        )
                    }
                },
            )
        }
    }
}

@Composable
private fun DobDateInputContent(
    digits: String,
    onDigitsChange: (String) -> Unit,
    pattern: String,
    errorMessage: String?,
    onToggleMode: () -> Unit,
    onDone: () -> Unit,
) {
    val focusRequester = remember { FocusRequester() }
    LaunchedEffect(Unit) {
        delay(200)
        focusRequester.requestFocus()
    }
    Column(modifier = Modifier.padding(bottom = 12.dp)) {
        DobPickerModeTitle(inputMode = true, onToggle = onToggleMode)
        OutlinedTextField(
            value = digits,
            onValueChange = { raw ->
                onDigitsChange(raw.filter(Char::isDigit).take(DATE_DIGIT_COUNT))
            },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .focusRequester(focusRequester)
                .semantics {
                    contentDescription = "Date of birth"
                    if (errorMessage != null) error(errorMessage)
                },
            label = { Text("Date of birth") },
            placeholder = { Text(pattern.uppercase(Locale.US)) },
            supportingText = {
                if (errorMessage != null) Text(errorMessage)
            },
            isError = errorMessage != null,
            visualTransformation = remember(pattern) { DobDateVisualTransformation(pattern) },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            keyboardActions = KeyboardActions(onDone = { onDone() }),
            singleLine = true,
        )
    }
}

@Composable
private fun DobPickerModeTitle(inputMode: Boolean, onToggle: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 24.dp, end = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = if (inputMode) "Enter date" else "Select date",
            style = MaterialTheme.typography.labelLarge,
        )
        IconButton(onClick = onToggle) {
            Icon(
                imageVector = if (inputMode) Icons.Filled.DateRange else Icons.Filled.Edit,
                contentDescription = if (inputMode) "Select date" else "Enter date",
            )
        }
    }
}

private const val DATE_DIGIT_COUNT = 8

/** Inserts the pattern delimiter while the stored value stays digits only. */
private class DobDateVisualTransformation(pattern: String) : VisualTransformation {
    private val delimiter: Char = pattern.first { it == '/' || it == '-' || it == '.' }
    private val firstDelimiterOffset: Int = pattern.indexOf(delimiter)
    private val secondDelimiterOffset: Int = pattern.lastIndexOf(delimiter)
    private val dateFormatLength: Int = pattern.count { it != delimiter }
    private val offsetMapping = object : OffsetMapping {
        override fun originalToTransformed(offset: Int): Int {
            return when {
                offset < firstDelimiterOffset -> offset
                offset < secondDelimiterOffset -> offset + 1
                offset <= dateFormatLength -> offset + 2
                else -> dateFormatLength + 2
            }
        }

        override fun transformedToOriginal(offset: Int): Int {
            return when {
                offset <= firstDelimiterOffset - 1 -> offset
                offset <= secondDelimiterOffset - 1 -> offset - 1
                offset <= dateFormatLength + 1 -> offset - 2
                else -> dateFormatLength
            }
        }
    }

    override fun filter(text: AnnotatedString): TransformedText {
        val trimmed = text.text.take(dateFormatLength)
        val shown = buildString {
            trimmed.forEachIndexed { index, char ->
                append(char)
                if (index + 1 == firstDelimiterOffset || index + 2 == secondDelimiterOffset) {
                    append(delimiter)
                }
            }
        }
        return TransformedText(AnnotatedString(shown), offsetMapping)
    }
}
