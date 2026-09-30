package com.dhama.mybase.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dhama.mybase.core.data.AccountSync
import com.dhama.mybase.core.data.DataStoreRepo
import com.dhama.mybase.core.domain.AuthRepository
import com.dhama.mybase.core.domain.ChatRepository
import com.dhama.mybase.core.domain.CompanionRepository
import com.dhama.mybase.core.domain.MemoryRepository
import com.dhama.mybase.core.model.CompanionDraft
import com.dhama.mybase.core.model.SavedCompanion
import com.dhama.mybase.core.network.avatarPhotoError
import com.dhama.mybase.core.network.displayNameError
import com.dhama.mybase.core.utils.PreferencesKeys
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.coroutines.cancellation.CancellationException

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val dataStoreRepo: DataStoreRepo,
    private val companionRepository: CompanionRepository,
    private val authRepository: AuthRepository,
    private val chatRepository: ChatRepository,
    private val memoryRepository: MemoryRepository,
    private val accountSync: AccountSync,
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

    val messages = chatRepository.observe()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val _archived = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val archived = _archived.asSharedFlow()

    private val _accountDeleted = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val accountDeleted = _accountDeleted.asSharedFlow()

    private val _archiveFailed = MutableSharedFlow<String>(extraBufferCapacity = 1)
    val archiveFailed = _archiveFailed.asSharedFlow()

    private val _nameMessage = MutableStateFlow<String?>(null)
    val nameMessage = _nameMessage.asStateFlow()

    private val _photoSaving = MutableStateFlow(false)
    val photoSaving = _photoSaving.asStateFlow()

    private val _photoMessage = MutableStateFlow<String?>(null)
    val photoMessage = _photoMessage.asStateFlow()

    fun setThemeMode(mode: String) {
        viewModelScope.launch { dataStoreRepo.saveString(PreferencesKeys.THEME_MODE, mode) }
    }

    fun setScreenPrivacy(enabled: Boolean) {
        viewModelScope.launch { dataStoreRepo.saveBoolean(PreferencesKeys.SCREEN_PRIVACY, enabled) }
    }

    fun setDisplayName(name: String) {
        val trimmed = name.trim()
        val error = displayNameError(trimmed)
        if (error != null) {
            _nameMessage.value = error
            return
        }
        viewModelScope.launch {
            _nameMessage.value = null
            try {
                val saved = accountSync.saveDisplayName(trimmed)
                dataStoreRepo.saveString(PreferencesKeys.DISPLAY_NAME, saved)
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                _nameMessage.value = "Couldn't save your name."
            }
        }
    }

    fun uploadPhoto(bytes: ByteArray, mime: String) {
        val error = avatarPhotoError(mime, bytes.size.toLong())
        if (error != null) {
            _photoMessage.value = error
            return
        }
        viewModelScope.launch {
            _photoSaving.value = true
            _photoMessage.value = null
            try {
                companionRepository.uploadPhoto(bytes, mime)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                _photoMessage.value = error.message?.takeIf { it.isNotBlank() } ?: "Couldn't save her photo."
            } finally {
                _photoSaving.value = false
            }
        }
    }

    fun rejectPhoto(message: String) {
        _photoMessage.value = message
    }

    fun saveCompanion(current: SavedCompanion, draft: CompanionDraft) {
        viewModelScope.launch {
            try {
                companionRepository.saveEdit(current, draft)
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                // The phone keeps the companion that was already saved.
            }
        }
    }

    fun archive() {
        viewModelScope.launch {
            try {
                companionRepository.archive()
                _archived.emit(Unit)
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                _archiveFailed.emit("Couldn't archive her. She's still here.")
            }
        }
    }

    fun deleteAccount() {
        viewModelScope.launch {
            authRepository.deleteRemoteAccount()
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
