package com.dhama.mybase.ui.onboarding

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dhama.mybase.core.domain.CompanionRepository
import com.dhama.mybase.core.model.CompanionDraft
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject

enum class WizardStep {
    Intro,
    Appearance,
    Personality,
    Voice,
    Finalize,
}

data class WizardUiState(
    val step: WizardStep = WizardStep.Intro,
    val draft: CompanionDraft = CompanionDraft(),
    val creating: Boolean = false,
    val error: String? = null,
    val nameError: String? = null,
)

@HiltViewModel
class CompanionWizardViewModel @Inject constructor(
    private val savedStateHandle: SavedStateHandle,
    private val repository: CompanionRepository,
) : ViewModel() {

    private val json = Json { ignoreUnknownKeys = true }

    private val _state = MutableStateFlow(restore())
    val state = _state.asStateFlow()

    private val _created = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val created = _created.asSharedFlow()

    fun update(transform: (CompanionDraft) -> CompanionDraft) {
        _state.update { it.copy(draft = transform(it.draft), nameError = null, error = null) }
        persist()
    }

    fun next() {
        val following = _state.value.step.next() ?: return
        _state.update { it.copy(step = following, error = null) }
        persist()
    }

    /** Returns false when the caller should leave the wizard. */
    fun back(): Boolean {
        val previous = _state.value.step.previous() ?: return false
        _state.update { it.copy(step = previous, error = null, nameError = null) }
        persist()
        return true
    }

    fun create() {
        val draft = _state.value.draft
        val nameError = draft.nameError()
        if (nameError != null) {
            _state.update { it.copy(nameError = nameError, error = null) }
            return
        }
        if (_state.value.creating) return
        viewModelScope.launch {
            _state.update { it.copy(creating = true, error = null, nameError = null) }
            try {
                repository.save(draft.toSaved(System.currentTimeMillis()))
                _state.update { it.copy(creating = false) }
                _created.emit(Unit)
            } catch (error: Exception) {
                if (error is kotlinx.coroutines.CancellationException) throw error
                _state.update {
                    it.copy(
                        creating = false,
                        error = "We couldn't create ${draft.normalizedName()} just now. Nothing you chose has been lost.",
                    )
                }
            }
        }
    }

    private fun persist() {
        val snapshot = _state.value
        savedStateHandle[DRAFT_KEY] = json.encodeToString(snapshot.draft)
        savedStateHandle[STEP_KEY] = snapshot.step.name
    }

    private fun restore(): WizardUiState {
        val draft = savedStateHandle.get<String>(DRAFT_KEY)?.let { raw ->
            runCatching { json.decodeFromString<CompanionDraft>(raw) }.getOrNull()
        } ?: CompanionDraft()
        val step = savedStateHandle.get<String>(STEP_KEY)
            ?.let { runCatching { WizardStep.valueOf(it) }.getOrNull() }
            ?: WizardStep.Intro
        return WizardUiState(step = step, draft = draft)
    }

    private companion object {
        const val DRAFT_KEY = "companion_draft"
        const val STEP_KEY = "companion_step"
    }
}

private fun WizardStep.next(): WizardStep? = when (this) {
    WizardStep.Intro -> WizardStep.Appearance
    WizardStep.Appearance -> WizardStep.Personality
    WizardStep.Personality -> WizardStep.Voice
    WizardStep.Voice -> WizardStep.Finalize
    WizardStep.Finalize -> null
}

private fun WizardStep.previous(): WizardStep? = when (this) {
    WizardStep.Intro -> null
    WizardStep.Appearance -> WizardStep.Intro
    WizardStep.Personality -> WizardStep.Appearance
    WizardStep.Voice -> WizardStep.Personality
    WizardStep.Finalize -> WizardStep.Voice
}

fun WizardStep.progressIndex(): Int = ordinal
