package com.dhama.mybase.debug

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.io.File

/**
 * Debug-only way for the emulator job to put a long draft in the composer.
 * Maestro's inputText call is killed after 120 seconds, which is not enough
 * to type the 7100-character cap. Release builds do not include this receiver.
 */
object DebugDraft {
    private var apply: ((String) -> Unit)? = null

    fun install(apply: (String) -> Unit) {
        this.apply = apply
    }

    fun clear() {
        apply = null
    }

    fun deliver(text: String): Boolean {
        val apply = apply ?: return false
        apply(text)
        return true
    }
}

class DebugDraftReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION) return
        val file = File(context.filesDir, FILE_NAME)
        val text = if (file.isFile) file.readText() else return
        if (text.length != EXPECTED_LENGTH) return
        if (!DebugDraft.deliver(text)) return
        file.delete()
        File(context.filesDir, OK_NAME).writeText(text.length.toString())
    }

    companion object {
        const val ACTION = "com.dhama.mybase.DEBUG_CHAT_DRAFT"
        const val FILE_NAME = "maestro-draft.txt"
        const val OK_NAME = "maestro-draft-ok"
        const val EXPECTED_LENGTH = 7100
    }
}
