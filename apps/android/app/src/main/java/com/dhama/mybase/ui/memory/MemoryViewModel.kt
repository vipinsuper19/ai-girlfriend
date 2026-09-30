package com.dhama.mybase.ui.memory

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dhama.mybase.core.db.entity.MemoryEntity
import com.dhama.mybase.core.domain.MemoryRepository
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
class MemoryViewModel @Inject constructor(
    private val repository: MemoryRepository,
) : ViewModel() {

    val memories = repository.observe()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _hiddenIds = MutableStateFlow<Set<String>>(emptySet())
    val hiddenIds = _hiddenIds.asStateFlow()

    private val _pendingDelete = MutableStateFlow<MemoryEntity?>(null)
    val pendingDelete = _pendingDelete.asStateFlow()

    private val _clearing = MutableStateFlow(false)
    val clearing = _clearing.asStateFlow()

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
            repository.clear()
            _clearing.value = false
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
