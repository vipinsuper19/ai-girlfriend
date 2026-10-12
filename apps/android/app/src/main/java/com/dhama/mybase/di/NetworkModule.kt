package com.dhama.mybase.di

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import com.dhama.mybase.BuildConfig
import com.dhama.mybase.core.data.DataStoreSessionStore
import com.dhama.mybase.core.data.MessageReportRepository
import com.dhama.mybase.core.network.ApiClient
import com.dhama.mybase.core.network.NetworkSignals
import com.dhama.mybase.core.network.SessionStore
import com.dhama.mybase.core.network.coldStartOkHttp
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import javax.inject.Singleton

@InstallIn(SingletonComponent::class)
@Module
object NetworkModule {

    @Provides
    @Singleton
    fun provideNetworkSignals(): NetworkSignals = NetworkSignals()

    @Provides
    @Singleton
    fun provideOkHttp(signals: NetworkSignals): OkHttpClient = coldStartOkHttp(signals)

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

    @Provides
    @Singleton
    fun provideMessageReportRepository(api: ApiClient): MessageReportRepository {
        return MessageReportRepository { body -> api.reportMessage(body) }
    }
}
