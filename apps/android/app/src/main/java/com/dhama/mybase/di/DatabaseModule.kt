package com.dhama.mybase.di

import android.content.Context
import androidx.room.Room
import com.dhama.mybase.core.db.AppDatabase
import com.dhama.mybase.core.data.ChatRepositoryImpl
import com.dhama.mybase.core.data.MemoryRepositoryImpl
import com.dhama.mybase.core.db.dao.ChatMessageDao
import com.dhama.mybase.core.db.dao.MemoryDao
import com.dhama.mybase.core.db.dao.NotesDao
import com.dhama.mybase.core.db.dao.UserDao
import com.dhama.mybase.core.domain.ChatRepository
import com.dhama.mybase.core.domain.MemoryRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import kotlin.jvm.java


@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase {
        return Room.databaseBuilder(context, AppDatabase::class.java, "my_database")
            .fallbackToDestructiveMigration(true)
            .build()
    }

    @Provides
    @Singleton
    fun provideMyDao(database: AppDatabase): UserDao {
        return database.userDao()
    }

    @Provides
    @Singleton
    fun provideNotesDao(database: AppDatabase): NotesDao = database.notesDao()

    @Provides
    @Singleton
    fun provideChatMessageDao(database: AppDatabase): ChatMessageDao = database.chatMessageDao()

    @Provides
    @Singleton
    fun provideChatRepository(dao: ChatMessageDao): ChatRepository = ChatRepositoryImpl(dao)

    @Provides
    @Singleton
    fun provideMemoryDao(database: AppDatabase): MemoryDao = database.memoryDao()

    @Provides
    @Singleton
    fun provideMemoryRepository(dao: MemoryDao): MemoryRepository = MemoryRepositoryImpl(dao)
}