import org.gradle.api.DefaultTask
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.TaskAction
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.google.gms.google.services)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt.android)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.parcelize)
}

// v1 leaves these off. Set one to true and rebuild to show that feature again.
val featureVoice = false
val featureGallery = false
val featurePush = false
val featureBilling = false
val featurePhoneSignIn = false

android {
    namespace = "com.dhama.mybase"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.dhama.mybase"
        minSdk = 29
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        buildConfigField("boolean", "FEATURE_VOICE", featureVoice.toString())
        buildConfigField("boolean", "FEATURE_GALLERY", featureGallery.toString())
        buildConfigField("boolean", "FEATURE_PUSH", featurePush.toString())
        buildConfigField("boolean", "FEATURE_BILLING", featureBilling.toString())
        buildConfigField("boolean", "FEATURE_PHONE_SIGN_IN", featurePhoneSignIn.toString())
        manifestPlaceholders["pushServiceEnabled"] = featurePush.toString()
    }

    // Release signing comes from CI secrets. If they are missing, the release build is unsigned.
    val keystorePath = System.getenv("KEYSTORE_PATH")
    val releaseSigning = if (!keystorePath.isNullOrBlank() && file(keystorePath).exists()) {
        signingConfigs.create("release") {
            storeFile = file(keystorePath)
            storePassword = System.getenv("KEYSTORE_PASSWORD")
            keyAlias = System.getenv("KEY_ALIAS")
            keyPassword = System.getenv("KEY_PASSWORD")
        }
    } else null

    buildTypes {
        debug {
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:3001/api/v1/\"")
        }
        release {
            releaseSigning?.let { signingConfig = it }
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            buildConfigField("String", "API_BASE_URL", "\"https://api.example.invalid/api/v1/\"")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

val featureFlagManifest = tasks.register<FeatureFlagManifestTask>("writeFeatureFlagManifest") {
    voiceEnabled.set(featureVoice)
    pushEnabled.set(featurePush)
    billingEnabled.set(featureBilling)
    outputManifest.set(layout.buildDirectory.file("generated/featureFlags/AndroidManifest.xml"))
}

androidComponents {
    onVariants { variant ->
        variant.sources.manifests.addGeneratedManifestFile(featureFlagManifest) { task ->
            task.outputManifest
        }
    }
}

abstract class FeatureFlagManifestTask : DefaultTask() {
    @get:Input
    abstract val voiceEnabled: Property<Boolean>

    @get:Input
    abstract val pushEnabled: Property<Boolean>

    @get:Input
    abstract val billingEnabled: Property<Boolean>

    @get:OutputFile
    abstract val outputManifest: RegularFileProperty

    @TaskAction
    fun write() {
        fun permission(name: String, enabled: Boolean): String {
            val node = if (enabled) "" else """ tools:node="remove""""
            return """    <uses-permission android:name="$name"$node />"""
        }
        val xml = """
            |<?xml version="1.0" encoding="utf-8"?>
            |<manifest xmlns:android="http://schemas.android.com/apk/res/android"
            |    xmlns:tools="http://schemas.android.com/tools">
            |${permission("android.permission.RECORD_AUDIO", voiceEnabled.get())}
            |${permission("android.permission.POST_NOTIFICATIONS", pushEnabled.get())}
            |${permission("com.android.vending.BILLING", billingEnabled.get())}
            |</manifest>
            |
        """.trimMargin()
        val file = outputManifest.get().asFile
        file.parentFile.mkdirs()
        file.writeText(xml)
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.material.icons.extended)

    implementation(libs.coil)
    implementation(libs.androidx.ui.text.google.fonts)
    implementation(libs.compose.navigation)

    implementation(libs.firebase.auth)
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services.auth)
    implementation(libs.googleid)
    implementation(libs.firebase.database)
    implementation(libs.firebase.messaging)
    implementation(libs.androidx.datastore)
    implementation(libs.media3.exoplayer)

    implementation(libs.hilt.android)
    implementation(libs.hilt.android.compose)
    ksp(libs.hilt.android.compiler)

    ksp(libs.room)
    annotationProcessor(libs.room)
    implementation(libs.room.kotlin)
    implementation(libs.room.paging)
    testImplementation(libs.room.testing)

    implementation(libs.kotlinx.serialization.json)
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter)
    implementation(libs.okhttp)
    implementation(libs.billing.ktx)



    testImplementation(libs.junit)
    testImplementation("org.mockito:mockito-core:5.18.0")
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}