package com.dhama.mybase.ui.home

import androidx.lifecycle.ViewModel
import com.dhama.mybase.core.data.AgeGatePrompt
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class AgeGatePromptViewModel @Inject constructor(
    prompt: AgeGatePrompt,
) : ViewModel() {
    val show = prompt.show
}
