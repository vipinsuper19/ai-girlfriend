package com.dhama.mybase.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dhama.mybase.core.data.ChatRepositoryImpl
import com.dhama.mybase.core.data.DataStoreRepo
import com.dhama.mybase.core.db.entity.ChatMessageEntity
import com.dhama.mybase.core.domain.ChatRepository
import com.dhama.mybase.core.domain.CompanionRepository
import com.dhama.mybase.core.domain.MemoryRepository
import com.dhama.mybase.core.utils.PreferencesKeys
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val chatRepository: ChatRepository,
    private val memoryRepository: MemoryRepository,
    private val dataStoreRepo: DataStoreRepo,
    companionRepository: CompanionRepository,
) : ViewModel() {

    val messages = chatRepository.observe()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val companion = companionRepository.observe()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    private val _draft = MutableStateFlow("")
    val draft = _draft.asStateFlow()

    val warningDismissedPeriod = dataStoreRepo.getString(PreferencesKeys.USAGE_WARNING_PERIOD, false)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "")

    private var sendJob: Job? = null

    init {
        viewModelScope.launch {
            companionRepository.observe().collect { saved ->
                if (saved != null) chatRepository.ensureGreeting(saved.greeting)
            }
        }
    }

    fun updateDraft(value: String) {
        _draft.value = value
    }

    fun send(prompt: String? = null) {
        val text = (prompt ?: _draft.value).trim()
        val saved = companion.value ?: return
        if (text.isEmpty() || sendJob?.isActive == true) return
        if (prompt == null) _draft.value = ""
        sendJob = viewModelScope.launch {
            chatRepository.send(text, saved.name, saved.relationship, saved.traits)
            memoryRepository.notice(text)
        }
    }

    fun sendVoice(path: String, durationMs: Long) {
        if (path.isBlank() || sendJob?.isActive == true) return
        viewModelScope.launch {
            chatRepository.sendVoice(path, durationMs)
        }
    }

    fun stop() {
        sendJob?.cancel()
        sendJob = null
    }

    fun delete(message: ChatMessageEntity) {
        viewModelScope.launch { chatRepository.delete(message.id) }
    }

    fun dismissUsageWarning(periodStartEpochMs: Long) {
        viewModelScope.launch {
            dataStoreRepo.saveString(PreferencesKeys.USAGE_WARNING_PERIOD, periodStartEpochMs.toString())
        }
    }

    fun retry(failed: ChatMessageEntity) {
        val saved = companion.value ?: return
        if (sendJob?.isActive == true) return
        val thread = messages.value
        val index = thread.indexOfFirst { it.id == failed.id }
        if (index < 0) return
        val source = if (failed.role == ChatRepositoryImpl.ROLE_USER) {
            failed
        } else {
            thread.getOrNull(index - 1)?.takeIf { it.role == ChatRepositoryImpl.ROLE_USER }
        } ?: return
        if (source.text.isBlank()) return
        sendJob = viewModelScope.launch {
            chatRepository.delete(failed.id)
            if (source.id != failed.id) chatRepository.delete(source.id)
            chatRepository.send(source.text, saved.name, saved.relationship, saved.traits)
            memoryRepository.notice(source.text)
        }
    }
}
