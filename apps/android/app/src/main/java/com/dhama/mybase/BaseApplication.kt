package com.dhama.mybase

import android.app.Application
import com.dhama.mybase.core.data.AgeServerSync
import com.dhama.mybase.core.telemetry.ProductTelemetry
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class BaseApplication : Application() {
    @Inject lateinit var ageServerSync: AgeServerSync

    override fun onCreate() {
        super.onCreate()
        ageServerSync.warm()
        ProductTelemetry.start(this)
    }
}