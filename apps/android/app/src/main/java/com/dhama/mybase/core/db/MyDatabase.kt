package com.dhama.mybase.core.db

import androidx.room.Database
import androidx.room.RoomDatabase
import com.dhama.mybase.core.db.dao.ChatMessageDao
import com.dhama.mybase.core.db.dao.NotesDao
import com.dhama.mybase.core.db.dao.UserDao
import com.dhama.mybase.core.db.entity.ChatMessageEntity
import com.dhama.mybase.core.db.entity.Notes
import com.dhama.mybase.core.db.entity.User

@Database(entities = [User::class, Notes::class, ChatMessageEntity::class], version = 5, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun userDao(): UserDao
    abstract fun notesDao(): NotesDao
    abstract fun chatMessageDao(): ChatMessageDao
}