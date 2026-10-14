package com.dhama.mybase.core.data

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import javax.inject.Inject
import javax.inject.Singleton

/** Asks the navigator to show the on-device age gate. Does not wait for it. */
@Singleton
class AgeGatePrompt @Inject constructor() {
    private val _show = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val show = _show.asSharedFlow()

    fun show() {
        _show.tryEmit(Unit)
    }
}
