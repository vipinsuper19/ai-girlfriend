package com.dhama.mybase.di

import com.dhama.mybase.core.data.NotesRepositoryImpl
import com.dhama.mybase.core.data.UserRepoImpl
import com.dhama.mybase.core.db.dao.NotesDao
import com.dhama.mybase.core.db.dao.UserDao
import com.dhama.mybase.core.domain.NotesRepository
import com.dhama.mybase.core.domain.UserRepo
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@InstallIn(SingletonComponent::class)
@Module
object AppModule {

    @Provides
    @Singleton
    fun provideNotesRepo(notesDao: NotesDao): NotesRepository {
        return NotesRepositoryImpl(notesDao)
    }

    @Provides
    @Singleton
    fun provideUserRepo(userDao: UserDao): UserRepo {
        return UserRepoImpl(userDao)
    }


}