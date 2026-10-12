package com.dhama.mybase.ui.screen.vm

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dhama.mybase.core.age.evaluateAgeGate
import com.dhama.mybase.core.age.parseDateOfBirth
import com.dhama.mybase.core.data.AgeAttestationStore
import com.dhama.mybase.core.data.DataStoreRepo
import com.dhama.mybase.core.domain.AuthRepository
import com.dhama.mybase.core.utils.PreferencesKeys
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import javax.inject.Inject
import kotlin.coroutines.cancellation.CancellationException

@HiltViewModel
class AgeConfirmViewModel @Inject constructor(
    private val dataStoreRepo: DataStoreRepo,
    private val authRepository: AuthRepository,
    private val ageAttestation: AgeAttestationStore,
) : ViewModel() {

    val storedDateOfBirth = dataStoreRepo.getString(PreferencesKeys.DATE_OF_BIRTH, false)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "")

    private val _saving = MutableStateFlow(false)
    val saving = _saving.asStateFlow()

    private val _confirmed = MutableStateFlow(false)
    val confirmed = _confirmed.asStateFlow()

    fun confirm(dateOfBirth: String) {
        val birth = parseDateOfBirth(dateOfBirth) ?: return
        if (!evaluateAgeGate(confirmedAdult = true, dateOfBirth = birth, today = LocalDate.now()).allowed) return
        if (_saving.value) return
        viewModelScope.launch {
            _saving.value = true
            try {
                val confirmedAt = Instant.now().toString()
                ageAttestation.save(dateOfBirth, confirmedAt)
                ageAttestation.pushIfEnabled(dateOfBirth, confirmedAt)
                _confirmed.value = true
            } catch (error: CancellationException) {
                throw error
            } finally {
                _saving.value = false
            }
        }
    }

    fun signOut(onDone: () -> Unit) {
        viewModelScope.launch {
            authRepository.logout()
            dataStoreRepo.saveBoolean(PreferencesKeys.IS_LOGGED_IN, false)
            onDone()
        }
    }
}
