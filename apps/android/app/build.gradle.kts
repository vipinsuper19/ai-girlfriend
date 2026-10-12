import com.android.build.api.variant.BuildConfigField
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.io.File
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.google.gms.google.services)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt.android)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.parcelize)
}

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

fun apiBaseUrl(buildType: String, flavors: List<String>): String {
    val type = configKey(buildType)
    val flavor = flavors.joinToString("_") { configKey(it) }.takeIf { it.isNotEmpty() }
    val keys = buildList {
        if (flavor != null) add("API_BASE_URL_${flavor}_$type")
        if (type.isNotEmpty()) add("API_BASE_URL_$type")
        if (flavor != null) add("API_BASE_URL_$flavor")
        add("API_BASE_URL")
    }
    keys.firstNotNullOfOrNull { configuredValue(it) }?.let { return it }
    return if (buildType.equals("debug", ignoreCase = true)) {
        "http://10.0.2.2:3001/api/v1/"
    } else {
        "https://api.example.invalid/api/v1/"
    }
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
    val path = signingSecret("RELEASE_STORE_FILE")
    val storePassword = signingSecret("RELEASE_STORE_PASSWORD")
    val keyAlias = signingSecret("RELEASE_KEY_ALIAS")
    val keyPassword = signingSecret("RELEASE_KEY_PASSWORD")
    val storeFile = path?.let(::resolveKeystore)
    if (storeFile != null && storePassword != null && keyAlias != null && keyPassword != null) {
        return ReleaseSigningSetup(ReleaseSigning(storeFile, storePassword, keyAlias, keyPassword), null)
    }
    val missing = buildList {
        if (path == null) add("RELEASE_STORE_FILE")
        if (storePassword == null) add("RELEASE_STORE_PASSWORD")
        if (keyAlias == null) add("RELEASE_KEY_ALIAS")
        if (keyPassword == null) add("RELEASE_KEY_PASSWORD")
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

releaseSigningSetup.problem?.let { problem ->
    gradle.taskGraph.whenReady {
        val releaseRequested = allTasks.any { task ->
            task.project.path == project.path && "Release" in task.name
        }
        if (releaseRequested) {
            logger.warn(
                "Release signing is not configured ($problem). " +
                    "bundleRelease will produce an unsigned AAB. " +
                    "Set RELEASE_STORE_FILE, RELEASE_STORE_PASSWORD, RELEASE_KEY_ALIAS, and RELEASE_KEY_PASSWORD " +
                    "in the environment or local.properties to sign.",
            )
        }
    }
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
            isMinifyEnabled = false
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

// One API_BASE_URL per variant (flavor + build type). There are no product flavors
// today, so debug/release resolve API_BASE_URL_DEBUG / API_BASE_URL_RELEASE, then
// API_BASE_URL, then the built-in default.
androidComponents {
    onVariants { variant ->
        val flavors = variant.productFlavors.map { it.second }
        val buildType = variant.buildType.orEmpty()
        val fields = checkNotNull(variant.buildConfigFields) {
            "buildConfigFields is unavailable; buildFeatures.buildConfig must stay enabled"
        }
        fields.put(
            "API_BASE_URL",
            BuildConfigField(
                type = "String",
                value = javaStringLiteral(apiBaseUrl(buildType, flavors)),
                comment = "REST API base URL",
            ),
        )
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
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}