package com.dhama.mybase.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dhama.mybase.core.memory.RankedMemory
import com.dhama.mybase.core.memory.pickMemoryHighlight
import com.dhama.mybase.core.data.AccountSync
import com.dhama.mybase.core.data.DataStoreRepo
import com.dhama.mybase.core.data.ChatRepositoryImpl
import com.dhama.mybase.core.domain.AuthRepository
import com.dhama.mybase.core.domain.ChatRepository
import com.dhama.mybase.core.domain.CompanionRepository
import com.dhama.mybase.core.domain.MemoryRepository
import com.dhama.mybase.core.model.SavedCompanion
import com.dhama.mybase.core.network.parseUsageSummary
import com.dhama.mybase.core.utils.PreferencesKeys
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class CompanionHomeViewModel @Inject constructor(
    private val repository: CompanionRepository,
    private val dataStoreRepo: DataStoreRepo,
    private val authRepository: AuthRepository,
    private val chatRepository: ChatRepository,
    private val memoryRepository: MemoryRepository,
    private val accountSync: AccountSync,
) : ViewModel() {

    val companion: StateFlow<SavedCompanion?> = repository.observe()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    val memoryHighlight = memoryRepository.observe()
        .map { list ->
            pickMemoryHighlight(
                list.map { RankedMemory(it.content, it.importance, it.createdAtEpochMs) },
                System.currentTimeMillis(),
            )
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    val displayName = dataStoreRepo.getString(PreferencesKeys.DISPLAY_NAME, false)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "")

    val hasTalked = chatRepository.observe()
        .map { messages -> messages.any { it.role == ChatRepositoryImpl.ROLE_USER } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false)

    val lastReply = chatRepository.observe()
        .map { messages ->
            messages.lastOrNull {
                it.role == ChatRepositoryImpl.ROLE_ASSISTANT &&
                    it.id != ChatRepositoryImpl.GREETING_ID &&
                    it.text.isNotBlank()
            }?.text
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    val usage = dataStoreRepo.getString(PreferencesKeys.USAGE_SUMMARY, false)
        .map { parseUsageSummary(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    init {
        viewModelScope.launch {
            try {
                accountSync.refreshUsage()
            } catch (error: kotlin.coroutines.cancellation.CancellationException) {
                throw error
            } catch (_: Exception) {
                // The last saved allowance stays on screen.
            }
        }
    }

    val warningDismissedPeriod = dataStoreRepo.getString(PreferencesKeys.USAGE_WARNING_PERIOD, false)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "")

    val planLabel = dataStoreRepo.getString(PreferencesKeys.SUBSCRIPTION_PLAN, false)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "")

    private val _loggedOut = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val loggedOut = _loggedOut.asSharedFlow()

    fun dismissUsageWarning(periodStartEpochMs: Long) {
        viewModelScope.launch {
            dataStoreRepo.saveString(PreferencesKeys.USAGE_WARNING_PERIOD, periodStartEpochMs.toString())
        }
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            dataStoreRepo.saveBoolean(PreferencesKeys.IS_LOGGED_IN, false)
            repository.clear()
            chatRepository.clear()
            memoryRepository.clear()
            dataStoreRepo.saveString(PreferencesKeys.SUBSCRIPTION_PLAN, "")
            dataStoreRepo.saveString(PreferencesKeys.USAGE_SUMMARY, "")
            _loggedOut.emit(Unit)
        }
    }
}
