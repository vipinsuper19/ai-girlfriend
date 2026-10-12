package com.dhama.mybase.di

import com.dhama.mybase.core.age.AgeSeal
import com.dhama.mybase.core.data.KeystoreAgeSeal
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class AgeModule {
    @Binds
    @Singleton
    abstract fun bindAgeSeal(impl: KeystoreAgeSeal): AgeSeal
}
