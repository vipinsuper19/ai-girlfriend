package com.dhama.mybase

import android.app.Application
import com.dhama.mybase.core.telemetry.ProductTelemetry
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class BaseApplication: Application() {
    override fun onCreate() {
        super.onCreate()
        ProductTelemetry.start(this)
    }
}