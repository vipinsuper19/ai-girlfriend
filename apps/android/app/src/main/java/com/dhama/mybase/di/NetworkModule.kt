package com.dhama.mybase.di

import com.dhama.mybase.core.network.ApiService
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import kotlin.jvm.java


@InstallIn(SingletonComponent::class)
@Module
object NetworkModule {

    @Provides
    fun provideApiService() : ApiService {
        return Retrofit.Builder().baseUrl("https://www.omdbapi.com")
            .addConverterFactory(GsonConverterFactory.create()).build().create(ApiService::class.java)
    }


}