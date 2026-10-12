import com.android.build.api.variant.BuildConfigField
import org.gradle.api.GradleException
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

val debugApiBaseUrl = "http://10.0.2.2:3001/api/v1/"
val placeholderApiBaseUrl = "https://api.example.invalid/api/v1/"

fun allowPlaceholderApi(): Boolean =
    (findProperty("allowPlaceholderApi") as? String).normalizeConfig()
        ?.equals("true", ignoreCase = true) == true

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

// One API_BASE_URL per variant. Debug falls back to the emulator host. Release fails
// unless a URL is configured, or -PallowPlaceholderApi=true opts into the placeholder.
androidComponents {
    onVariants { variant ->
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