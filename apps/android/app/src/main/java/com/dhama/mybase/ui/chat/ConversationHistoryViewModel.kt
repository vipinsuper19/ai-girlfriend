package com.dhama.mybase.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dhama.mybase.core.data.AccountSync
import com.dhama.mybase.core.domain.CompanionRepository
import com.dhama.mybase.core.network.RemoteConversation
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.coroutines.cancellation.CancellationException

@HiltViewModel
class ConversationHistoryViewModel @Inject constructor(
    private val accountSync: AccountSync,
    private val companions: CompanionRepository,
) : ViewModel() {

    val companion = companions.observe()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    private val _conversations = MutableStateFlow<List<RemoteConversation>>(emptyList())
    val conversations = _conversations.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading = _loading.asStateFlow()

    private val _busy = MutableStateFlow(false)
    val busy = _busy.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error = _error.asStateFlow()

    private val _hiddenIds = MutableStateFlow<Set<Int>>(emptySet())
    val hiddenIds = _hiddenIds.asStateFlow()

    private val _pendingDelete = MutableStateFlow<RemoteConversation?>(null)
    val pendingDelete = _pendingDelete.asStateFlow()

    private var deleteJob: Job? = null

    fun refresh() {
        viewModelScope.launch {
            _loading.value = true
            try {
                _conversations.value = accountSync.listCompanionConversations()
                _error.value = null
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                _error.value = error.message?.takeIf { it.isNotBlank() } ?: "Couldn't load conversations."
            } finally {
                _loading.value = false
            }
        }
    }

    fun open(id: Int, onOpened: () -> Unit) {
        if (_busy.value) return
        viewModelScope.launch {
            _busy.value = true
            try {
                if (companion.value?.conversationId != id) {
                    accountSync.openConversation(id)
                }
                onOpened()
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                _error.value = error.message?.takeIf { it.isNotBlank() } ?: "Couldn't open that conversation."
            } finally {
                _busy.value = false
            }
        }
    }

    fun start(onStarted: () -> Unit) {
        if (_busy.value) return
        viewModelScope.launch {
            _busy.value = true
            try {
                accountSync.startConversation()
                onStarted()
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                _error.value = error.message?.takeIf { it.isNotBlank() } ?: "Couldn't start a conversation."
            } finally {
                _busy.value = false
            }
        }
    }

    fun stageDelete(conversation: RemoteConversation) {
        commitPending()
        _hiddenIds.value = _hiddenIds.value + conversation.id
        _pendingDelete.value = conversation
        deleteJob = viewModelScope.launch {
            delay(UNDO_MS)
            finishDelete(conversation.id)
        }
    }

    fun undoDelete() {
        val conversation = _pendingDelete.value ?: return
        deleteJob?.cancel()
        deleteJob = null
        _hiddenIds.value = _hiddenIds.value - conversation.id
        _pendingDelete.value = null
    }

    private fun commitPending() {
        val conversation = _pendingDelete.value ?: return
        deleteJob?.cancel()
        deleteJob = null
        val id = conversation.id
        _pendingDelete.value = null
        viewModelScope.launch { finishDelete(id) }
    }

    private suspend fun finishDelete(id: Int) {
        try {
            accountSync.deleteConversation(id)
            _conversations.value = accountSync.listCompanionConversations()
            _error.value = null
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            _error.value = error.message?.takeIf { it.isNotBlank() } ?: "Couldn't delete that conversation. It's still here."
        } finally {
            _hiddenIds.value = _hiddenIds.value - id
            if (_pendingDelete.value?.id == id) _pendingDelete.value = null
        }
    }

    companion object {
        private const val UNDO_MS = 4_000L
    }
}
