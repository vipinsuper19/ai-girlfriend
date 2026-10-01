package com.dhama.mybase.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dhama.mybase.core.chat.retriesByReload
import com.dhama.mybase.core.data.ChatRepositoryImpl
import com.dhama.mybase.core.data.DataStoreRepo
import com.dhama.mybase.core.db.entity.ChatMessageEntity
import com.dhama.mybase.core.domain.ChatRepository
import com.dhama.mybase.core.domain.CompanionRepository
import com.dhama.mybase.core.domain.MemoryRepository
import com.dhama.mybase.core.network.ApiStatusException
import com.dhama.mybase.core.utils.PreferencesKeys
import com.dhama.mybase.core.voice.canSpeakMessage
import com.dhama.mybase.core.voice.speakBlockReason
import com.dhama.mybase.core.voice.speakFailure
import com.dhama.mybase.core.voice.voiceRoundTripLabel
import com.dhama.mybase.core.voice.voiceRoundTripStage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject
import kotlin.coroutines.cancellation.CancellationException

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
    private val spokenUrls = mutableMapOf<String, String>()

    private val _speakingId = MutableStateFlow<String?>(null)
    val speakingId = _speakingId.asStateFlow()

    private val _speakNote = MutableStateFlow<Pair<String, String>?>(null)
    val speakNote = _speakNote.asStateFlow()

    private val _playRequest = MutableSharedFlow<String>(extraBufferCapacity = 1)
    val playRequest = _playRequest.asSharedFlow()

    private val _voiceStage = MutableStateFlow<String?>(null)
    val voiceStage = _voiceStage.asStateFlow()

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
            chatRepository.send(text, saved.name, saved.relationship, saved.traits, saved.conversationId)
            memoryRepository.notice(text)
        }
    }

    fun sendVoice(path: String, durationMs: Long) {
        if (path.isBlank() || sendJob?.isActive == true) return
        val conversationId = companion.value?.conversationId
        sendJob = viewModelScope.launch {
            val ticker = if (conversationId != null) {
                launch {
                    val started = System.currentTimeMillis()
                    while (isActive) {
                        _voiceStage.value = voiceRoundTripLabel(
                            voiceRoundTripStage(System.currentTimeMillis() - started),
                        )
                        delay(250)
                    }
                }
            } else {
                null
            }
            try {
                chatRepository.sendVoice(path, durationMs, conversationId)
            } finally {
                ticker?.cancel()
                _voiceStage.value = null
            }
        }
    }

    fun stop() {
        sendJob?.cancel()
        sendJob = null
    }

    fun delete(message: ChatMessageEntity) {
        viewModelScope.launch { chatRepository.delete(message.id) }
    }

    fun speak(message: ChatMessageEntity) {
        if (!canSpeakMessage(message.role, message.kind, message.delivery, message.text)) return
        val companionId = companion.value?.serverId
        val blocked = speakBlockReason(message.text, companionId)
        if (blocked != null) {
            _speakNote.value = message.id to blocked
            return
        }
        val id = companionId ?: return
        spokenUrls[message.id]?.let { cached ->
            _speakNote.value = null
            _playRequest.tryEmit(cached)
            return
        }
        if (_speakingId.value != null) return
        viewModelScope.launch {
            _speakingId.value = message.id
            _speakNote.value = null
            try {
                val url = chatRepository.speak(id, message.text)
                spokenUrls[message.id] = url
                _playRequest.emit(url)
            } catch (error: CancellationException) {
                throw error
            } catch (error: ApiStatusException) {
                _speakNote.value = message.id to speakFailure(error.status)
            } catch (_: Exception) {
                _speakNote.value = message.id to speakFailure(0)
            } finally {
                _speakingId.value = null
            }
        }
    }

    fun dismissUsageWarning(periodStartEpochMs: Long) {
        viewModelScope.launch {
            dataStoreRepo.saveString(PreferencesKeys.USAGE_WARNING_PERIOD, periodStartEpochMs.toString())
        }
    }

    fun retry(failed: ChatMessageEntity) {
        val saved = companion.value ?: return
        if (sendJob?.isActive == true) return
        if (retriesByReload(failed.delivery)) {
            val conversationId = saved.conversationId ?: return
            sendJob = viewModelScope.launch {
                try {
                    chatRepository.reload(conversationId)
                } catch (error: CancellationException) {
                    throw error
                } catch (_: Exception) {
                    // The dropped reply stays, so Retry can be tapped again.
                }
            }
            return
        }
        val thread = messages.value
        val index = thread.indexOfFirst { it.id == failed.id }
        if (index < 0) return
        val source = if (failed.role == ChatRepositoryImpl.ROLE_USER) {
            failed
        } else {
            thread.getOrNull(index - 1)?.takeIf { it.role == ChatRepositoryImpl.ROLE_USER }
        } ?: return
        sendJob = viewModelScope.launch {
            chatRepository.discard(failed.id)
            if (source.id != failed.id) chatRepository.discard(source.id)
            if (source.kind == ChatMessageEntity.KIND_AUDIO && source.audioPath.isNotBlank()) {
                chatRepository.sendVoice(source.audioPath, source.durationMs, saved.conversationId)
            } else if (source.text.isNotBlank()) {
                chatRepository.send(source.text, saved.name, saved.relationship, saved.traits, saved.conversationId)
                memoryRepository.notice(source.text)
            }
        }
    }
}
