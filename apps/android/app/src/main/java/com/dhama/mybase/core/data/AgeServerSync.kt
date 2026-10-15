package com.dhama.mybase.core.data

import com.dhama.mybase.core.age.AgeFollowUp
import com.dhama.mybase.core.age.ApiAgeGate
import com.dhama.mybase.core.age.ageAttestDelayMs
import com.dhama.mybase.core.age.ageAttestShouldRetry
import com.dhama.mybase.core.age.ageFollowUp
import com.dhama.mybase.core.network.ApiClient
import com.dhama.mybase.core.network.ApiStatusException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Sends `{"ageConfirmed": true}` when this device already passed the gate and
 * the server has no `ageConfirmedAt`. The call returns immediately. Failures
 * retry with backoff and never block the screen.
 */
class AgeServerSync(
    private val api: ApiClient,
    private val gate: ApiAgeGate,
    private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO),
    private val wait: suspend (Long) -> Unit = { kotlinx.coroutines.delay(it) },
) {
    private val mutex = Mutex()
    @Volatile private var sawAuthUser = false
    private var patchJob: Job? = null

    init {
        api.onAuthUser = { userPresent, ageConfirmedAt ->
            // Set before the coroutine so a startup check cannot race a fresh login.
            if (userPresent) sawAuthUser = true
            scope.launch { handleAuthUser(userPresent, ageConfirmedAt) }
        }
    }

    /** Touched at process start so the auth listener is registered before login. */
    fun warm() = Unit

    /** Cold start. Skipped when register, login, or Google already reported a user. */
    fun onStartup() {
        scope.launch {
            if (!gate.localGatePassed()) return@launch
            val fetch = mutex.withLock { !sawAuthUser }
            if (!fetch) return@launch
            val confirmedAt = try {
                api.getMe().ageConfirmedAt?.takeIf { it.isNotBlank() }
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                return@launch
            }
            mutex.withLock {
                if (sawAuthUser) return@withLock
                if (confirmedAt == null) startPatchLocked()
            }
        }
    }

    /** The local gate just passed. Patch without waiting for the next GET. */
    fun afterLocalPass() {
        scope.launch {
            if (!gate.localGatePassed()) return@launch
            mutex.withLock { startPatchLocked() }
        }
    }

    private suspend fun handleAuthUser(userPresent: Boolean, ageConfirmedAt: String?) {
        val passed = gate.localGatePassed()
        val followUp = ageFollowUp(passed, userPresent, ageConfirmedAt)
        mutex.withLock {
            when (followUp) {
                AgeFollowUp.None -> cancelPatchLocked()
                AgeFollowUp.Patch -> startPatchLocked()
                AgeFollowUp.FetchProfile -> Unit
            }
        }
        if (followUp == AgeFollowUp.FetchProfile) onStartup()
    }

    private fun startPatchLocked() {
        patchJob?.cancel()
        patchJob = scope.launch { runPatch() }
    }

    private fun cancelPatchLocked() {
        patchJob?.cancel()
        patchJob = null
    }

    private suspend fun runPatch() {
        var attempt = 0
        while (true) {
            val pause = ageAttestDelayMs(attempt) ?: return
            if (pause > 0) wait(pause)
            try {
                api.patchAge()
                return
            } catch (error: CancellationException) {
                throw error
            } catch (error: ApiStatusException) {
                if (!ageAttestShouldRetry(error.status)) return
            } catch (_: Exception) {
                // The next delay covers a dropped connection.
            }
            attempt += 1
        }
    }
}
