package com.dhama.mybase.core.domain

import com.dhama.mybase.core.model.SavedCompanion
import kotlinx.coroutines.flow.Flow

interface CompanionRepository {
    fun observe(): Flow<SavedCompanion?>
    suspend fun save(companion: SavedCompanion)
    suspend fun clear()
}
