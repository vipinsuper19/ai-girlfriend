package com.dhama.mybase.core.domain

import com.dhama.mybase.core.db.dao.NotesDao
import com.dhama.mybase.core.db.entity.Notes
import kotlinx.coroutines.flow.Flow

interface NotesRepository {
    fun getAllNotes(): Flow<List<Notes>>
    fun getNoteById(id: Int): Flow<Notes>
    suspend fun insert(notes: Notes)
    suspend fun delete(id: Int)
}

