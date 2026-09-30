package com.dhama.mybase.core.domain

import com.dhama.mybase.core.model.CompanionDraft
import com.dhama.mybase.core.model.SavedCompanion
import kotlinx.coroutines.flow.Flow

interface CompanionRepository {
    fun observe(): Flow<SavedCompanion?>
    suspend fun save(companion: SavedCompanion)
    suspend fun create(draft: CompanionDraft): SavedCompanion
    suspend fun saveEdit(current: SavedCompanion, draft: CompanionDraft)
    suspend fun archive()
    suspend fun clear()
}
