package com.dhama.mybase.di

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import com.dhama.mybase.core.data.CompanionRepositoryImpl
import com.dhama.mybase.core.domain.CompanionRepository
import com.dhama.mybase.core.network.ApiClient
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@InstallIn(SingletonComponent::class)
@Module
object CompanionModule {

    @Provides
    @Singleton
    fun provideCompanionRepository(
        dataStore: DataStore<Preferences>,
        api: ApiClient,
    ): CompanionRepository = CompanionRepositoryImpl(dataStore, api)
}
