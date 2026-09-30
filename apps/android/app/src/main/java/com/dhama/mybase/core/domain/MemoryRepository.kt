package com.dhama.mybase.core.domain

import com.dhama.mybase.core.db.entity.MemoryEntity
import kotlinx.coroutines.flow.Flow

interface MemoryRepository {
    fun observe(): Flow<List<MemoryEntity>>
    suspend fun notice(userText: String)
    suspend fun update(id: String, content: String, type: String, importance: Int)
    suspend fun delete(id: String)
    suspend fun clear()
    suspend fun clearAll(onProgress: suspend (done: Int, total: Int) -> Unit): MemoryClearResult
}

data class MemoryClearResult(val removed: Int, val kept: Int)
