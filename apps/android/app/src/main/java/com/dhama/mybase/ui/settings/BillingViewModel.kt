package com.dhama.mybase.ui.settings

import android.app.Activity
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dhama.mybase.core.billing.PlayBilling
import com.dhama.mybase.core.billing.PlayOffer
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.coroutines.cancellation.CancellationException

@HiltViewModel
class BillingViewModel @Inject constructor(
    private val billing: PlayBilling,
) : ViewModel() {

    private val _offers = MutableStateFlow<List<PlayOffer>>(emptyList())
    val offers = _offers.asStateFlow()

    private val _note = MutableStateFlow<String?>(null)
    val note = _note.asStateFlow()

    init {
        viewModelScope.launch { billing.notes.collect { _note.value = it } }
        viewModelScope.launch {
            try {
                billing.syncOwned()
                _offers.value = billing.offers()
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                // Plans stay read-only when Play or the server cannot list them.
            }
        }
    }

    fun buy(activity: Activity, offer: PlayOffer) {
        _note.value = null
        if (!billing.launch(activity, offer)) {
            _note.value = "Google Play couldn't open the purchase."
        }
    }
}
