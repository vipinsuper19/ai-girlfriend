package com.dhama.mybase.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dhama.mybase.core.db.entity.ChatMessageEntity
import com.dhama.mybase.core.domain.ChatRepository
import com.dhama.mybase.core.domain.CompanionRepository
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
    companionRepository: CompanionRepository,
) : ViewModel() {

    val messages = chatRepository.observe()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val companion = companionRepository.observe()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    private val _draft = MutableStateFlow("")
    val draft = _draft.asStateFlow()

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
        }
    }

    fun stop() {
        sendJob?.cancel()
        sendJob = null
    }

    fun delete(message: ChatMessageEntity) {
        viewModelScope.launch { chatRepository.delete(message.id) }
    }
}
