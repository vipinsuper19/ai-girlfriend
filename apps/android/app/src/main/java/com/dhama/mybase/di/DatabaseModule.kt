package com.dhama.mybase.di

import android.content.Context
import androidx.room.Room
import com.dhama.mybase.core.db.AppDatabase
import com.dhama.mybase.core.db.dao.NotesDao
import com.dhama.mybase.core.db.dao.UserDao
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
    fun provideNotesDao(database: AppDatabase): NotesDao {
        return database.notesDao()
    }


}