package com.dhama.mybase.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dhama.mybase.core.data.DataStoreRepo
import com.dhama.mybase.core.domain.AuthRepository
import com.dhama.mybase.core.domain.ChatRepository
import com.dhama.mybase.core.domain.CompanionRepository
import com.dhama.mybase.core.domain.MemoryRepository
import com.dhama.mybase.core.model.CompanionDraft
import com.dhama.mybase.core.model.SavedCompanion
import com.dhama.mybase.core.utils.PreferencesKeys
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val dataStoreRepo: DataStoreRepo,
    private val companionRepository: CompanionRepository,
    private val authRepository: AuthRepository,
    private val chatRepository: ChatRepository,
    private val memoryRepository: MemoryRepository,
) : ViewModel() {

    val themeMode = dataStoreRepo.getString(PreferencesKeys.THEME_MODE, false)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "")

    val screenPrivacy = dataStoreRepo.getBoolean(PreferencesKeys.SCREEN_PRIVACY, true)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), true)

    val displayName = dataStoreRepo.getString(PreferencesKeys.DISPLAY_NAME, false)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "")

    val email = dataStoreRepo.getString(PreferencesKeys.USER_EMAIL, false)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "")

    val companion = companionRepository.observe()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    val memories = memoryRepository.observe()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _archived = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val archived = _archived.asSharedFlow()

    private val _accountDeleted = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val accountDeleted = _accountDeleted.asSharedFlow()

    fun setThemeMode(mode: String) {
        viewModelScope.launch { dataStoreRepo.saveString(PreferencesKeys.THEME_MODE, mode) }
    }

    fun setScreenPrivacy(enabled: Boolean) {
        viewModelScope.launch { dataStoreRepo.saveBoolean(PreferencesKeys.SCREEN_PRIVACY, enabled) }
    }

    fun setDisplayName(name: String) {
        viewModelScope.launch { dataStoreRepo.saveString(PreferencesKeys.DISPLAY_NAME, name.trim()) }
    }

    fun saveCompanion(current: SavedCompanion, draft: CompanionDraft) {
        viewModelScope.launch {
            companionRepository.save(draft.toSaved(current.createdAtEpochMs))
        }
    }

    fun archive() {
        viewModelScope.launch {
            companionRepository.clear()
            _archived.emit(Unit)
        }
    }

    fun deleteAccount() {
        viewModelScope.launch {
            authRepository.logout()
            dataStoreRepo.saveBoolean(PreferencesKeys.IS_LOGGED_IN, false)
            dataStoreRepo.saveString(PreferencesKeys.DISPLAY_NAME, "")
            companionRepository.clear()
            chatRepository.clear()
            memoryRepository.clear()
            _accountDeleted.emit(Unit)
        }
    }
}
