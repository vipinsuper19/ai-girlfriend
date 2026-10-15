package com.dhama.mybase.ui.onboarding

import android.util.Log
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dhama.mybase.core.FeatureFlags
import com.dhama.mybase.core.data.AccountSync
import com.dhama.mybase.core.domain.CompanionRepository
import com.dhama.mybase.core.model.CompanionDraft
import com.dhama.mybase.core.network.RemoteAvatarSummary
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
    val archived: List<RemoteAvatarSummary> = emptyList(),
)

@HiltViewModel
class CompanionWizardViewModel @Inject constructor(
    private val savedStateHandle: SavedStateHandle,
    private val repository: CompanionRepository,
    private val accountSync: AccountSync,
    private val flags: FeatureFlags,
) : ViewModel() {

    private val json = Json { ignoreUnknownKeys = true }

    private val _state = MutableStateFlow(restore())
    val state = _state.asStateFlow()

    private val _created = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val created = _created.asSharedFlow()

    init {
        viewModelScope.launch {
            val archived = runCatching { accountSync.archivedCompanions() }.getOrElse { error ->
                if (error is kotlinx.coroutines.CancellationException) throw error
                emptyList()
            }
            _state.update { it.copy(archived = archived) }
        }
    }

    fun bringBack(id: Int) {
        if (_state.value.creating) return
        viewModelScope.launch {
            _state.update { it.copy(creating = true, error = null) }
            try {
                accountSync.unarchive(id)
                _state.update { it.copy(creating = false) }
                _created.emit(Unit)
            } catch (error: Exception) {
                if (error is kotlinx.coroutines.CancellationException) throw error
                _state.update {
                    it.copy(creating = false, error = "Couldn't bring her back just now.")
                }
            }
        }
    }

    fun update(transform: (CompanionDraft) -> CompanionDraft) {
        _state.update { it.copy(draft = transform(it.draft), nameError = null, error = null) }
        persist()
    }

    fun next() {
        val following = _state.value.step.next(flags.voice) ?: return
        _state.update { it.copy(step = following, error = null) }
        persist()
    }

    /** Returns false when the caller should leave the wizard. */
    fun back(): Boolean {
        val previous = _state.value.step.previous(flags.voice) ?: return false
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
                repository.create(draft)
                _state.update { it.copy(creating = false) }
                _created.emit(Unit)
            } catch (error: Exception) {
                if (error is kotlinx.coroutines.CancellationException) throw error
                Log.w("CompanionWizard", "create failed", error)
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
        val restored = savedStateHandle.get<String>(STEP_KEY)
            ?.let { runCatching { WizardStep.valueOf(it) }.getOrNull() }
            ?: WizardStep.Intro
        val step = if (!flags.voice && restored == WizardStep.Voice) WizardStep.Finalize else restored
        return WizardUiState(step = step, draft = draft)
    }

    private companion object {
        const val DRAFT_KEY = "companion_draft"
        const val STEP_KEY = "companion_step"
    }
}

internal fun WizardStep.next(voiceEnabled: Boolean): WizardStep? = when (this) {
    WizardStep.Intro -> WizardStep.Appearance
    WizardStep.Appearance -> WizardStep.Personality
    WizardStep.Personality -> if (voiceEnabled) WizardStep.Voice else WizardStep.Finalize
    WizardStep.Voice -> WizardStep.Finalize
    WizardStep.Finalize -> null
}

internal fun WizardStep.previous(voiceEnabled: Boolean): WizardStep? = when (this) {
    WizardStep.Intro -> null
    WizardStep.Appearance -> WizardStep.Intro
    WizardStep.Personality -> WizardStep.Appearance
    WizardStep.Voice -> WizardStep.Personality
    WizardStep.Finalize -> if (voiceEnabled) WizardStep.Voice else WizardStep.Personality
}

internal fun WizardStep.progressIndex(voiceEnabled: Boolean): Int = when {
    voiceEnabled -> ordinal
    this == WizardStep.Finalize -> 3
    else -> ordinal.coerceAtMost(2)
}

internal fun wizardStepTotal(voiceEnabled: Boolean): Int = if (voiceEnabled) 4 else 3
