package com.dhama.mybase.debug

/** Release builds have no debug draft receiver. */
object DebugDraft {
    @Suppress("UNUSED_PARAMETER")
    fun install(apply: (String) -> Unit) = Unit

    fun clear() = Unit
}
