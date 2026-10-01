package com.dhama.mybase.core.data

import com.dhama.mybase.core.db.dao.NotesDao
import com.dhama.mybase.core.db.entity.Notes
import com.dhama.mybase.core.domain.NotesRepository
import kotlinx.coroutines.flow.Flow

class NotesRepositoryImpl(
    private val notesDao: NotesDao
) : NotesRepository {
    override fun getAllNotes(): Flow<List<Notes>> = notesDao.getAllNotes()
    override fun getNoteById(id: Int): Flow<Notes> = notesDao.getNoteById(id)
    override suspend fun insert(notes: Notes) = notesDao.insert(notes)
    override suspend fun delete(id: Int) = notesDao.delete(id)
}