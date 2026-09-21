package com.dhama.mybase.core.db

import androidx.room.Database
import androidx.room.RoomDatabase
import com.dhama.mybase.core.db.dao.NotesDao
import com.dhama.mybase.core.db.dao.UserDao
import com.dhama.mybase.core.db.entity.Notes
import com.dhama.mybase.core.db.entity.User

@Database(entities = [User::class, Notes::class], version = 4, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun userDao(): UserDao
    abstract fun notesDao(): NotesDao
}