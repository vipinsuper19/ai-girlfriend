import com.android.build.api.variant.BuildConfigField
import com.google.firebase.crashlytics.buildtools.gradle.CrashlyticsExtension
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.TaskAction
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.io.File
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.google.gms.google.services) apply false
    alias(libs.plugins.firebase.crashlytics) apply false
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

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.isFile) {
        file.inputStream().use(::load)
    }
}

fun configuredValue(name: String): String? {
    val env = System.getenv(name).normalizeConfig()
    if (env != null) return env
    val property = (findProperty(name) as? String).normalizeConfig()
    if (property != null) return property
    return localProperties.getProperty(name).normalizeConfig()
}

fun signingSecret(name: String): String? {
    val env = System.getenv(name).normalizeConfig()
    if (env != null) return env
    return localProperties.getProperty(name).normalizeConfig()
}

fun String?.normalizeConfig(): String? =
    this?.trim()?.removeSurrounding("\"")?.trim()?.takeIf { it.isNotEmpty() }

fun javaStringLiteral(value: String): String {
    val escaped = value
        .replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\r", "")
        .replace("\n", "")
    return "\"$escaped\""
}

fun configKey(raw: String): String = raw.uppercase().replace('-', '_').replace('.', '_')

// Local debug talks to the host machine. Maestro overrides this with
// -PAPI_BASE_URL_DEBUG (see .maestro/run-all.sh). That property wins for debug.
val debugApiBaseUrl = "http://10.0.2.2:3001/api/v1/"
val placeholderApiBaseUrl = "https://api.example.invalid/api/v1/"

fun allowPlaceholderApi(): Boolean =
    (findProperty("allowPlaceholderApi") as? String).normalizeConfig()
        ?.equals("true", ignoreCase = true) == true

// Release uploads the R8 mapping file to Crashlytics. Placeholder CI builds, and any
// build passed -PdisableMappingUpload=true, skip that upload.
fun disableMappingUpload(): Boolean {
    val explicit = (findProperty("disableMappingUpload") as? String).normalizeConfig()
    if (explicit?.equals("true", ignoreCase = true) == true) return true
    return allowPlaceholderApi()
}

fun requireReleaseSigning(): Boolean =
    configuredValue("REQUIRE_RELEASE_SIGNING")?.equals("true", ignoreCase = true) == true

fun lookupApiBaseUrl(buildType: String, flavors: List<String>): String? {
    val type = configKey(buildType)
    val flavor = flavors.joinToString("_") { configKey(it) }.takeIf { it.isNotEmpty() }
    val keys = buildList {
        if (flavor != null) add("API_BASE_URL_${flavor}_$type")
        if (type.isNotEmpty()) add("API_BASE_URL_$type")
        if (flavor != null) add("API_BASE_URL_$flavor")
        add("API_BASE_URL")
    }
    return keys.firstNotNullOfOrNull { configuredValue(it) }
}

data class VariantApiUrl(
    val url: String,
    val unresolvedRelease: Boolean,
)

fun apiBaseUrl(buildType: String, flavors: List<String>): VariantApiUrl {
    lookupApiBaseUrl(buildType, flavors)?.let { return VariantApiUrl(it, unresolvedRelease = false) }
    if (buildType.equals("debug", ignoreCase = true)) {
        return VariantApiUrl(debugApiBaseUrl, unresolvedRelease = false)
    }
    if (allowPlaceholderApi()) {
        return VariantApiUrl(placeholderApiBaseUrl, unresolvedRelease = false)
    }
    return VariantApiUrl(placeholderApiBaseUrl, unresolvedRelease = true)
}

fun resolveKeystore(path: String): File? {
    val candidate = File(path)
    val resolved = if (candidate.isAbsolute) candidate else rootProject.file(path)
    return resolved.takeIf { it.isFile }
}

data class ReleaseSigning(
    val storeFile: File,
    val storePassword: String,
    val keyAlias: String,
    val keyPassword: String,
)

data class ReleaseSigningSetup(
    val signing: ReleaseSigning?,
    val problem: String?,
)

fun loadReleaseSigning(): ReleaseSigningSetup {
    val path = signingSecret("KEYSTORE_PATH")
    val storePassword = signingSecret("KEYSTORE_PASSWORD")
    val keyAlias = signingSecret("KEY_ALIAS")
    val keyPassword = signingSecret("KEY_PASSWORD")
    val storeFile = path?.let(::resolveKeystore)
    if (storeFile != null && storePassword != null && keyAlias != null && keyPassword != null) {
        return ReleaseSigningSetup(ReleaseSigning(storeFile, storePassword, keyAlias, keyPassword), null)
    }
    val missing = buildList {
        if (path == null) add("KEYSTORE_PATH")
        if (storePassword == null) add("KEYSTORE_PASSWORD")
        if (keyAlias == null) add("KEY_ALIAS")
        if (keyPassword == null) add("KEY_PASSWORD")
    }
    val details = buildList {
        if (missing.isNotEmpty()) add("missing ${missing.joinToString(", ")}")
        if (path != null && storeFile == null) {
            val lookedUp = if (File(path).isAbsolute) File(path).path else rootProject.file(path).path
            add("keystore not found at $lookedUp")
        }
    }
    return ReleaseSigningSetup(null, details.joinToString("; "))
}

val releaseSigningSetup = loadReleaseSigning()
val releaseSigning = releaseSigningSetup.signing
val unresolvedReleaseVariants = mutableListOf<String>()

gradle.taskGraph.whenReady {
    val releaseRequested = allTasks.any { task ->
        task.project.path == project.path && "Release" in task.name
    }
    if (!releaseRequested) return@whenReady
    if (unresolvedReleaseVariants.isNotEmpty()) {
        throw GradleException(
            "No API base URL is configured for ${unresolvedReleaseVariants.joinToString(", ")}. " +
                "Set API_BASE_URL_RELEASE (environment, Gradle property, or local.properties). " +
                "Pass -PallowPlaceholderApi=true to use $placeholderApiBaseUrl for a smoke build.",
        )
    }
    val problem = releaseSigningSetup.problem ?: return@whenReady
    if (requireReleaseSigning()) {
        throw GradleException(
            "Release signing is required but not configured ($problem). " +
                "Set KEYSTORE_PATH, KEYSTORE_PASSWORD, KEY_ALIAS, and KEY_PASSWORD " +
                "in the environment or local.properties.",
        )
    }
    logger.warn(
        "Release signing is not configured ($problem). " +
            "bundleRelease will produce an unsigned AAB. " +
            "Set KEYSTORE_PATH, KEYSTORE_PASSWORD, KEY_ALIAS, and KEY_PASSWORD " +
            "in the environment or local.properties to sign, " +
            "or REQUIRE_RELEASE_SIGNING=true to fail instead.",
    )
}

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

    testOptions {
        unitTests.isIncludeAndroidResources = true
        unitTests.isReturnDefaultValues = true
    }

    signingConfigs {
        releaseSigning?.let { signing ->
            create("release") {
                storeFile = signing.storeFile
                storePassword = signing.storePassword
                keyAlias = signing.keyAlias
                keyPassword = signing.keyPassword
            }
        }
    }

    buildTypes {
        release {
            if (releaseSigning != null) {
                signingConfig = signingConfigs.getByName("release")
            }
            // R8 is the shrinker AGP runs when minification is enabled.
            // Mapping upload is set after the Crashlytics plugin is applied below.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
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

// One API_BASE_URL per variant. Debug falls back to the emulator host. Release fails
// unless a URL is configured, or -PallowPlaceholderApi=true opts into the placeholder.
androidComponents {
    onVariants { variant ->
        if (variant.buildType == "debug") {
            variant.sources.assets?.addStaticSourceDirectory("schemas")
        }
        variant.sources.manifests.addGeneratedManifestFile(featureFlagManifest) { task ->
            task.outputManifest
        }
        val flavors = variant.productFlavors.map { it.second }
        val buildType = variant.buildType.orEmpty()
        val resolved = apiBaseUrl(buildType, flavors)
        if (resolved.unresolvedRelease) unresolvedReleaseVariants += variant.name
        val fields = checkNotNull(variant.buildConfigFields) {
            "buildConfigFields is unavailable; buildFeatures.buildConfig must stay enabled"
        }
        fields.put(
            "API_BASE_URL",
            BuildConfigField(
                type = "String",
                value = javaStringLiteral(resolved.url),
                comment = "REST API base URL",
            ),
        )
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

// bundleRelease runs after minify has finished publishing outputs. Checking from inside
// minifyReleaseWithR8 is too early: AGP copies mapping.txt to outputs after that task's own actions.
tasks.configureEach {
    if (name == "bundleRelease") {
        doLast {
            val candidates = listOf(
                layout.buildDirectory.file("outputs/mapping/release/mapping.txt").get().asFile,
                layout.buildDirectory.file("intermediates/mapping/release/minifyReleaseWithR8/mapping.txt").get().asFile,
            )
            val mapping = candidates.firstOrNull { it.isFile && it.length() > 0L }
            if (mapping == null) {
                throw GradleException(
                    "Crashlytics mapping file was not generated. Looked in ${candidates.joinToString { it.path }}. " +
                        "R8 writes it when release minification is on.",
                )
            }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
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

    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.analytics)
    implementation(libs.firebase.crashlytics)
    implementation(libs.firebase.auth)
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services.auth)
    implementation(libs.googleid)
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
    testImplementation(libs.androidx.junit)
    testImplementation("androidx.test:core:1.6.1")
    testImplementation("org.robolectric:robolectric:4.16")

    implementation(libs.kotlinx.serialization.json)
    implementation(libs.okhttp)
    implementation(libs.billing.ktx)
    implementation(libs.androidx.browser)



    testImplementation(libs.junit)
    testImplementation(libs.okhttp.mockwebserver)
    testImplementation("org.mockito:mockito-core:5.18.0")
    testImplementation("com.android.tools:r8:9.5.23")
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}

// Google Services and Crashlytics need google-services.json. Skip both when it is
// absent so a checkout without that file still configures and builds. No secrets are
// generated here.
val googleServicesFile = file("google-services.json")
if (googleServicesFile.isFile) {
    apply(plugin = "com.google.gms.google-services")
    apply(plugin = "com.google.firebase.crashlytics")
    // Plugin 3 adds CrashlyticsExtension only once the plugin is applied.
    // Release uploads mapping.txt unless disableMappingUpload() is true.
    android {
        buildTypes {
            getByName("release") {
                configure<CrashlyticsExtension> {
                    mappingFileUploadEnabled = !disableMappingUpload()
                }
            }
        }
    }
}
