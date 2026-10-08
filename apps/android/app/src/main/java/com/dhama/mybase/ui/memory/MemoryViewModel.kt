package com.dhama.mybase.ui.memory

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dhama.mybase.core.data.AccountSync
import com.dhama.mybase.core.db.entity.MemoryEntity
import com.dhama.mybase.core.domain.MemoryRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.coroutines.cancellation.CancellationException

@HiltViewModel
class MemoryViewModel @Inject constructor(
    private val repository: MemoryRepository,
    private val accountSync: AccountSync,
) : ViewModel() {

    val memories = repository.observe()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val paused = repository.observePaused()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false)

    private val _pauseSaving = MutableStateFlow(false)
    val pauseSaving = _pauseSaving.asStateFlow()

    private val _privacyNote = MutableStateFlow<String?>(null)
    val privacyNote = _privacyNote.asStateFlow()

    private val _adding = MutableStateFlow(false)
    val adding = _adding.asStateFlow()

    private val _addNote = MutableStateFlow<String?>(null)
    val addNote = _addNote.asStateFlow()

    private val _added = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val added = _added.asSharedFlow()

    private val _exporting = MutableStateFlow(false)
    val exporting = _exporting.asStateFlow()

    private val _exportJson = MutableStateFlow<String?>(null)
    val exportJson = _exportJson.asStateFlow()

    fun setPaused(paused: Boolean) {
        if (_pauseSaving.value) return
        viewModelScope.launch {
            _pauseSaving.value = true
            _privacyNote.value = null
            try {
                repository.setPaused(paused)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                _privacyNote.value = error.message?.takeIf { it.isNotBlank() } ?: "Couldn't update this setting."
            } finally {
                _pauseSaving.value = false
            }
        }
    }

    fun add(content: String, type: String) {
        if (content.isBlank()) {
            _addNote.value = "Write what she should remember."
            return
        }
        if (_adding.value) return
        viewModelScope.launch {
            _adding.value = true
            _addNote.value = null
            try {
                repository.add(content, type)
                _added.emit(Unit)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                _addNote.value = error.message?.takeIf { it.isNotBlank() } ?: "Couldn't save that memory."
            } finally {
                _adding.value = false
            }
        }
    }

    fun clearAddNote() {
        _addNote.value = null
    }

    fun prepareExport() {
        if (_exporting.value) return
        viewModelScope.launch {
            _exporting.value = true
            _privacyNote.value = null
            try {
                _exportJson.value = accountSync.exportData()
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                _privacyNote.value = error.message?.takeIf { it.isNotBlank() } ?: "Couldn't prepare your export."
            } finally {
                _exporting.value = false
            }
        }
    }

    fun exportFinished(note: String?) {
        _exportJson.value = null
        _privacyNote.value = note
    }

    private val _hiddenIds = MutableStateFlow<Set<String>>(emptySet())
    val hiddenIds = _hiddenIds.asStateFlow()

    private val _pendingDelete = MutableStateFlow<MemoryEntity?>(null)
    val pendingDelete = _pendingDelete.asStateFlow()

    private val _clearing = MutableStateFlow(false)
    val clearing = _clearing.asStateFlow()

    private val _clearProgress = MutableStateFlow<Pair<Int, Int>?>(null)
    val clearProgress = _clearProgress.asStateFlow()

    private val _clearNotice = MutableStateFlow<String?>(null)
    val clearNotice = _clearNotice.asStateFlow()

    private var deleteJob: Job? = null

    fun stageDelete(memory: MemoryEntity) {
        commitPending()
        _hiddenIds.value = _hiddenIds.value + memory.id
        _pendingDelete.value = memory
        deleteJob = viewModelScope.launch {
            delay(UNDO_MS)
            finishDelete(memory.id)
        }
    }

    fun undoDelete() {
        val memory = _pendingDelete.value ?: return
        deleteJob?.cancel()
        deleteJob = null
        _hiddenIds.value = _hiddenIds.value - memory.id
        _pendingDelete.value = null
    }

    fun save(id: String, content: String, type: String, importance: Int) {
        viewModelScope.launch {
            repository.update(id, content, type, importance)
        }
    }

    fun clearAll() {
        deleteJob?.cancel()
        _pendingDelete.value = null
        _hiddenIds.value = emptySet()
        viewModelScope.launch {
            _clearing.value = true
            _clearNotice.value = null
            try {
                val result = repository.clearAll { done, total ->
                    _clearProgress.value = done to total
                }
                _clearNotice.value = when {
                    result.kept == 0 -> null
                    result.removed == 0 -> "Couldn't forget them. They're still here."
                    else -> "${result.kept} still here. The rest are forgotten."
                }
            } catch (error: CancellationException) {
                throw error
            } finally {
                _clearing.value = false
                _clearProgress.value = null
            }
        }
    }

    private fun commitPending() {
        val memory = _pendingDelete.value ?: return
        deleteJob?.cancel()
        deleteJob = null
        val id = memory.id
        _pendingDelete.value = null
        viewModelScope.launch { finishDelete(id) }
    }

    private suspend fun finishDelete(id: String) {
        try {
            repository.delete(id)
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            // The memory is still stored, so show the row again.
        } finally {
            _hiddenIds.value = _hiddenIds.value - id
            if (_pendingDelete.value?.id == id) _pendingDelete.value = null
        }
    }

    companion object {
        private const val UNDO_MS = 4_000L
    }
}
