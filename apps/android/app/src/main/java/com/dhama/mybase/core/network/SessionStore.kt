package com.dhama.mybase.core.network

interface SessionStore {
    suspend fun read(): SessionTokens?
    suspend fun write(tokens: SessionTokens)
    suspend fun clear()
}
