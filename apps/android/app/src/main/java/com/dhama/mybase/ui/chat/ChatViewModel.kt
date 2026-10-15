package com.dhama.mybase.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dhama.mybase.core.FeatureFlags
import com.dhama.mybase.debug.DebugDraft
import com.dhama.mybase.core.chat.MESSAGE_PAGE
import com.dhama.mybase.core.chat.chatDraftOverLimit
import com.dhama.mybase.core.chat.REPORT_NOTE_MAX
import com.dhama.mybase.core.chat.REPORT_UNAVAILABLE
import com.dhama.mybase.core.chat.ReportReason
import com.dhama.mybase.core.chat.canOfferReport
import com.dhama.mybase.core.chat.olderMessageCursor
import com.dhama.mybase.core.chat.reportMessageBody
import com.dhama.mybase.core.chat.reportUnavailableReason
import com.dhama.mybase.core.chat.retriesByReload
import com.dhama.mybase.core.data.AccountSync
import com.dhama.mybase.core.data.ChatRepositoryImpl
import com.dhama.mybase.core.data.MessageReportRepository
import com.dhama.mybase.core.data.ReportResult
import com.dhama.mybase.core.network.parseUsageSummary
import com.dhama.mybase.core.usage.USAGE_LIMIT_CODE
import com.dhama.mybase.core.usage.messageAllowanceClosed
import com.dhama.mybase.core.usage.usageLimitBlocksMessages
import com.dhama.mybase.core.data.DataStoreRepo
import com.dhama.mybase.core.db.entity.ChatMessageEntity
import com.dhama.mybase.core.domain.ChatRepository
import com.dhama.mybase.core.domain.CompanionRepository
import com.dhama.mybase.core.domain.MemoryRepository
import com.dhama.mybase.core.network.ApiStatusException
import com.dhama.mybase.core.network.NetworkSignals
import com.dhama.mybase.core.network.RemoteSendFailure
import com.dhama.mybase.core.network.rateLimitNotice
import com.dhama.mybase.core.network.remoteSendFailure
import com.dhama.mybase.core.network.regenerableReplyId
import com.dhama.mybase.core.network.serverRecordId
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
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject
import kotlin.coroutines.cancellation.CancellationException

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val chatRepository: ChatRepository,
    private val memoryRepository: MemoryRepository,
    private val dataStoreRepo: DataStoreRepo,
    private val accountSync: AccountSync,
    networkSignals: NetworkSignals,
    private val reports: MessageReportRepository,
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

    /** Null until DataStore has loaded, so the first chat does not flash the notice for someone who already accepted it. */
    val aiDisclosureAcknowledged = dataStoreRepo
        .getBoolean(PreferencesKeys.AI_DISCLOSURE_ACKNOWLEDGED, false)
        .map { acknowledged -> acknowledged as Boolean? }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    val planUsage = dataStoreRepo.getString(PreferencesKeys.USAGE_SUMMARY, false)
        .map { parseUsageSummary(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    private val _usageBlocked = MutableStateFlow(false)
    val usageBlocked = _usageBlocked.asStateFlow()

    private val _loadingOlder = MutableStateFlow(false)
    val loadingOlder = _loadingOlder.asStateFlow()

    private val _olderExhausted = MutableStateFlow(false)
    val hasOlder = combine(messages, _olderExhausted) { thread, exhausted ->
        !exhausted && olderMessageCursor(thread.mapNotNull { serverRecordId(it.id) }) != null
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false)

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

    val serverWake = networkSignals.status

    private val _rateLimitNote = MutableStateFlow<String?>(null)
    val rateLimitNote = _rateLimitNote.asStateFlow()
    private var rateLimitUntilMs = 0L

    private val _replyNote = MutableStateFlow<String?>(null)
    val replyNote = _replyNote.asStateFlow()

    init {
        DebugDraft.install(::updateDraft)
        viewModelScope.launch {
            companionRepository.observe().collect { saved ->
                if (saved != null) chatRepository.ensureGreeting(saved.greeting)
            }
        }
        viewModelScope.launch {
            planUsage.collect { usage ->
                if (usage != null && !messageAllowanceClosed(usage)) _usageBlocked.value = false
            }
        }
        viewModelScope.launch { refreshUsage() }
        viewModelScope.launch {
            companion.map { it?.conversationId }.distinctUntilChanged().collect {
                _olderExhausted.value = false
            }
        }
    }

    fun loadOlder() {
        if (_loadingOlder.value || _olderExhausted.value) return
        val conversationId = companion.value?.conversationId ?: return
        val before = olderMessageCursor(messages.value.mapNotNull { serverRecordId(it.id) }) ?: return
        _loadingOlder.value = true
        viewModelScope.launch {
            try {
                val count = chatRepository.loadOlder(conversationId, before)
                if (count < MESSAGE_PAGE) _olderExhausted.value = true
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                // The lines already on screen stay, and Earlier messages can be tapped again.
            } finally {
                _loadingOlder.value = false
            }
        }
    }

    fun updateDraft(value: String) {
        _draft.value = value
    }

    fun send(prompt: String? = null) {
        val text = (prompt ?: _draft.value).trim()
        val saved = companion.value ?: return
        if (text.isEmpty() || chatDraftOverLimit(text) || sendJob?.isActive == true || rateLimitOpen()) return
        if (prompt == null) _draft.value = ""
        sendJob = viewModelScope.launch {
            _replyNote.value = null
            try {
                chatRepository.send(text, saved.name, saved.relationship, saved.traits, saved.conversationId)
                memoryRepository.notice(text)
                refreshUsage()
            } catch (error: CancellationException) {
                throw error
            } catch (error: ApiStatusException) {
                noteApiFailure(error)
            }
        }
    }

    fun sendVoice(path: String, durationMs: Long) {
        if (!FeatureFlags.build.voice || path.isBlank() || sendJob?.isActive == true || rateLimitOpen()) return
        val conversationId = companion.value?.conversationId
        sendJob = viewModelScope.launch {
            _replyNote.value = null
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
                refreshUsage()
            } catch (error: CancellationException) {
                throw error
            } catch (error: ApiStatusException) {
                noteApiFailure(error)
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

    val regenerableId = messages
        .map { thread -> regenerableReplyId(thread, { it.id }, { it.role }, { it.kind }) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    private val _regenerateNote = MutableStateFlow<String?>(null)
    val regenerateNote = _regenerateNote.asStateFlow()

    fun regenerate(message: ChatMessageEntity) {
        if (message.id != regenerableId.value || sendJob?.isActive == true || rateLimitOpen()) return
        _regenerateNote.value = null
        sendJob = viewModelScope.launch {
            try {
                chatRepository.regenerate(message.id)
                refreshUsage()
            } catch (error: CancellationException) {
                throw error
            } catch (error: ApiStatusException) {
                noteApiFailure(error)
                if (remoteSendFailure(error.status, error.code) == RemoteSendFailure.Other) {
                    _regenerateNote.value = error.message?.takeIf { it.isNotBlank() } ?: "Couldn't regenerate that."
                }
            } catch (_: Exception) {
                _regenerateNote.value = "Couldn't regenerate that. Her first reply is still here."
            }
        }
    }

    fun dismissRegenerateNote() {
        _regenerateNote.value = null
    }

    private val _report = MutableStateFlow<MessageReportUi?>(null)
    val report = _report.asStateFlow()
    private var reportJob: Job? = null

    fun openReport(message: ChatMessageEntity) {
        if (!canOfferReport(message.role)) return
        if (_report.value?.submitting == true) return
        val serverId = serverRecordId(message.id)
        val already = serverId != null && reports.alreadySent(serverId)
        _report.value = MessageReportUi(
            messageLocalId = message.id,
            sent = already,
            blocked = if (already) null else reportUnavailableReason(serverId, companion.value?.conversationId),
        )
    }

    fun selectReportReason(reason: ReportReason) {
        val current = _report.value ?: return
        if (current.submitting || current.sent || current.blocked != null) return
        _report.value = current.copy(selected = reason, error = null)
    }

    fun updateReportNote(value: String) {
        val current = _report.value ?: return
        if (current.submitting || current.sent || current.blocked != null) return
        _report.value = current.copy(note = value.take(REPORT_NOTE_MAX))
    }

    fun dismissReport() {
        if (_report.value?.submitting == true) return
        _report.value = null
    }

    fun submitReport() {
        val current = _report.value ?: return
        if (current.submitting || current.sent || current.blocked != null) return
        val reason = current.selected ?: return
        if (reportJob?.isActive == true) return
        val body = reportMessageBody(
            serverRecordId(current.messageLocalId),
            companion.value?.conversationId,
            reason.code,
            current.note,
        )
        if (body == null) {
            _report.value = current.copy(error = REPORT_UNAVAILABLE)
            return
        }
        _report.value = current.copy(submitting = true, error = null)
        reportJob = viewModelScope.launch {
            val result = reports.report(body)
            val latest = _report.value ?: return@launch
            if (latest.messageLocalId != current.messageLocalId) return@launch
            _report.value = when (result) {
                ReportResult.Sent, ReportResult.Duplicate ->
                    latest.copy(submitting = false, sent = true, error = null)
                is ReportResult.Failed -> latest.copy(submitting = false, error = result.message)
            }
        }
    }

    fun speak(message: ChatMessageEntity) {
        if (!FeatureFlags.build.voice) return
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
                if (error.code == USAGE_LIMIT_CODE) noteUsageLimit(error)
                _speakNote.value = message.id to speakFailure(error.status, error.code, error.message ?: "")
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

    fun acknowledgeAiDisclosure() {
        viewModelScope.launch {
            dataStoreRepo.saveBoolean(PreferencesKeys.AI_DISCLOSURE_ACKNOWLEDGED, true)
        }
    }

    fun dismissReplyNote() {
        _replyNote.value = null
    }

    fun retry(failed: ChatMessageEntity) {
        val saved = companion.value ?: return
        if (sendJob?.isActive == true || rateLimitOpen()) return
        _replyNote.value = null
        if (retriesByReload(failed.delivery)) {
            val conversationId = saved.conversationId ?: return
            sendJob = viewModelScope.launch {
                try {
                    chatRepository.retryUnfinishedReply(conversationId)
                    refreshUsage()
                } catch (error: CancellationException) {
                    throw error
                } catch (error: ApiStatusException) {
                    noteApiFailure(error)
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
            try {
                if (source.kind == ChatMessageEntity.KIND_AUDIO && source.audioPath.isNotBlank()) {
                    if (!FeatureFlags.build.voice) return@launch
                    chatRepository.discard(failed.id)
                    if (source.id != failed.id) chatRepository.discard(source.id)
                    chatRepository.sendVoice(source.audioPath, source.durationMs, saved.conversationId)
                } else if (source.text.isNotBlank()) {
                    chatRepository.retryUnsent(
                        source.text,
                        saved.name,
                        saved.relationship,
                        saved.traits,
                        saved.conversationId,
                        clientMessageId = source.id,
                        failedLocalId = failed.id,
                    )
                    memoryRepository.notice(source.text)
                }
                refreshUsage()
            } catch (error: CancellationException) {
                throw error
            } catch (error: ApiStatusException) {
                noteApiFailure(error)
            }
        }
    }

    private fun rateLimitOpen(): Boolean = System.currentTimeMillis() < rateLimitUntilMs

    private suspend fun noteApiFailure(error: ApiStatusException) {
        when (remoteSendFailure(error.status, error.code)) {
            RemoteSendFailure.AgeRequired -> Unit
            RemoteSendFailure.UsageLimit -> noteUsageLimit(error)
            RemoteSendFailure.RateLimited -> noteRateLimit(error)
            RemoteSendFailure.Missing -> {
                _replyNote.value = error.message?.takeIf { it.isNotBlank() }
                    ?: "That message isn't available."
            }
            RemoteSendFailure.NotLatest -> _replyNote.value = null
            RemoteSendFailure.InvalidKey -> {
                _replyNote.value = error.message?.takeIf { it.isNotBlank() }
                    ?: "Couldn't send that. Try again."
            }
            RemoteSendFailure.KeyReused -> {
                _replyNote.value = error.message?.takeIf { it.isNotBlank() }
                    ?: "That send belongs to another conversation. Try again."
            }
            RemoteSendFailure.Other -> noteUsageLimit(error)
        }
    }

    private fun noteRateLimit(error: ApiStatusException) {
        val seconds = (error.retryAfterSeconds ?: 1).coerceAtLeast(1)
        val until = System.currentTimeMillis() + seconds * 1000L
        rateLimitUntilMs = until
        _rateLimitNote.value = rateLimitNotice(seconds)
        viewModelScope.launch {
            delay(seconds * 1000L)
            if (rateLimitUntilMs == until) {
                rateLimitUntilMs = 0L
                _rateLimitNote.value = null
            }
        }
    }

    private suspend fun refreshUsage() {
        try {
            accountSync.refreshUsage()
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            // The last saved allowance stays on screen.
        }
    }

    override fun onCleared() {
        DebugDraft.clear()
        super.onCleared()
    }

    private suspend fun noteUsageLimit(error: ApiStatusException) {
        if (error.code != USAGE_LIMIT_CODE) return
        if (usageLimitBlocksMessages(error.message ?: "")) _usageBlocked.value = true
        refreshUsage()
    }
}

data class MessageReportUi(
    val messageLocalId: String,
    val selected: ReportReason? = null,
    val note: String = "",
    val submitting: Boolean = false,
    val error: String? = null,
    val sent: Boolean = false,
    val blocked: String? = null,
)
