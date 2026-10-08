package com.dhama.mybase.di

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import com.dhama.mybase.BuildConfig
import com.dhama.mybase.core.data.DataStoreSessionStore
import com.dhama.mybase.core.network.ApiClient
import com.dhama.mybase.core.network.SessionStore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@InstallIn(SingletonComponent::class)
@Module
object NetworkModule {

    @Provides
    @Singleton
    fun provideOkHttp(): OkHttpClient {
        return OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideSessionStore(dataStore: DataStore<Preferences>): SessionStore {
        return DataStoreSessionStore(dataStore)
    }

    @Provides
    @Singleton
    fun provideApiClient(http: OkHttpClient, store: SessionStore): ApiClient {
        return ApiClient(http, BuildConfig.API_BASE_URL, store)
    }
}
