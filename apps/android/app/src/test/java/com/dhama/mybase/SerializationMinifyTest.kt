package com.dhama.mybase

import com.android.tools.r8.CompilationMode
import com.android.tools.r8.OutputMode
import com.android.tools.r8.R8
import com.android.tools.r8.R8Command
import com.android.tools.r8.origin.Origin
import com.dhama.mybase.core.network.DtoRoundTrip
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.File
import java.nio.file.Files
import java.nio.file.Path
import java.util.jar.JarEntry
import java.util.jar.JarFile
import java.util.jar.JarOutputStream
import java.util.zip.ZipFile

/**
 * Shrinks the API DTO classes with the release keep rules and checks the wire
 * JSON still round-trips. A full release minify of the app is a separate Gradle build.
 */
class SerializationMinifyTest {

    @Test
    fun apiDtosRoundTripAfterR8() {
        val expected = DtoRoundTrip.payload()
        val rules = rulesFile()
        val program = Files.createTempDirectory("dto-program")
        val programJar = Files.createTempFile("dto-program", ".jar")
        val javaBase = Files.createTempFile("java-base", ".jar")
        val output = Files.createTempFile("dto-minified", ".jar")
        try {
            stageProgram(appClassesRoot(), program.toFile())
            packJar(program.toFile(), programJar)
            javaBaseJar(javaBase)
            val command = R8Command.builder()
                .addProgramFiles(programJar)
                .apply { libraryFiles(javaBase).forEach { addLibraryFiles(it) } }
                .addProguardConfigurationFiles(rules.toPath())
                .addProguardConfiguration(
                    listOf(
                        "-keep class com.dhama.mybase.core.network.DtoRoundTrip {",
                        "    public static com.dhama.mybase.core.network.DtoRoundTrip INSTANCE;",
                        "    public java.lang.String payload();",
                        "}",
                    ),
                    Origin.unknown(),
                )
                .setMode(CompilationMode.RELEASE)
                .setOutput(output, OutputMode.ClassFile)
                .build()
            R8.run(command)

            JarFile(output.toFile()).use { jar ->
                assertNotNull(jar.getJarEntry("com/dhama/mybase/core/model/CreateAvatarRequest\$\$serializer.class"))
                assertNull(jar.getJarEntry("com/dhama/mybase/core/network/ReleaseShrinkCanary.class"))
            }
            val minified = loadPayload(output)
            assertEquals(expected, minified)
        } finally {
            program.toFile().deleteRecursively()
            programJar.toFile().delete()
            javaBase.toFile().delete()
            output.toFile().delete()
        }
    }

    private fun loadPayload(jar: Path): String {
        val loader = MinifiedAppLoader(arrayOf(jar.toUri().toURL()), javaClass.classLoader)
        try {
            val type = loader.loadClass("com.dhama.mybase.core.network.DtoRoundTrip")
            val instance = type.getField("INSTANCE").get(null)
            return type.getMethod("payload").invoke(instance) as String
        } finally {
            loader.close()
        }
    }

    private class MinifiedAppLoader(
        urls: Array<java.net.URL>,
        parent: ClassLoader?,
    ) : java.net.URLClassLoader(urls, parent) {
        override fun loadClass(name: String, resolve: Boolean): Class<*> {
            if (name.startsWith("com.dhama.mybase")) {
                synchronized(this) {
                    findLoadedClass(name)?.let { return it }
                    val found = findClass(name)
                    if (resolve) resolveClass(found)
                    return found
                }
            }
            return super.loadClass(name, resolve)
        }
    }
}

private fun rulesFile(): File {
    val candidates = listOf(
        File("proguard-rules.pro"),
        File("app/proguard-rules.pro"),
        File("apps/android/app/proguard-rules.pro"),
    )
    return candidates.firstOrNull { it.isFile }
        ?: error("proguard-rules.pro not found from ${File(".").absolutePath}")
}

private val programPrefixes = listOf(
    "DtoRoundTrip",
    "ReleaseShrinkCanary",
    "ApiCodecKt",
    "ApiStatusException",
    "ExceptionPrivacyKt",
    "TransportFailure",
    "SessionTokens",
    "AuthSession",
    "RemoteUser",
    "AgeAck",
    "AgePatchRequest",
    "AgeWireKt",
    "GoogleAuthRequest",
    "CreateAvatarRequest",
    "AppearanceRequest",
    "PersonalityRequest",
    "VoiceRequest",
    "RegisterRequest",
    "RemoteUsageSummary",
    "RemoteUsageLine",
    "RemoteUsagePeriod",
    "RemoteMessage",
    "RemoteAvatar",
    "RemoteAppearance",
    "RemotePersonality",
    "RemoteVoice",
)

private fun appClassesRoot(): File {
    val url = DtoRoundTrip::class.java.protectionDomain?.codeSource?.location
        ?: error("DtoRoundTrip has no code source")
    val file = File(url.toURI())
    check(file.exists()) { "DtoRoundTrip code source does not exist: $file" }
    return file
}

private fun stageProgram(source: File, dest: File) {
    val names = mutableListOf<String>()
    if (source.isDirectory) {
        source.walkTopDown().filter { it.isFile && it.extension == "class" && isProgramClass(it.name) }.forEach { file ->
            val relative = file.relativeTo(source).path
            writeClass(dest, relative, file.readBytes())
            names += file.name
        }
    } else {
        JarFile(source).use { jar ->
            jar.entries().asSequence().filter { !it.isDirectory && it.name.endsWith(".class") && isProgramClass(File(it.name).name) }.forEach { entry ->
                writeClass(dest, entry.name, jar.getInputStream(entry).use { it.readBytes() })
                names += File(entry.name).name
            }
        }
    }
    check(names.any { it == "DtoRoundTrip.class" }) { "DtoRoundTrip.class missing in $source" }
    check(names.any { it == "ReleaseShrinkCanary.class" }) { "ReleaseShrinkCanary.class missing in $source" }
}

private fun isProgramClass(fileName: String): Boolean {
    val name = fileName.removeSuffix(".class")
    return programPrefixes.any { prefix -> name == prefix || name.startsWith("$prefix\$") }
}

private fun packJar(root: File, destination: Path) {
    JarOutputStream(Files.newOutputStream(destination)).use { jar ->
        root.walkTopDown().filter { it.isFile }.forEach { file ->
            val name = file.relativeTo(root).path.replace(File.separatorChar, '/')
            jar.putNextEntry(JarEntry(name))
            file.inputStream().use { it.copyTo(jar) }
            jar.closeEntry()
        }
    }
}

private fun writeClass(dest: File, relative: String, bytes: ByteArray) {
    val out = dest.resolve(relative)
    out.parentFile?.mkdirs()
    out.writeBytes(bytes)
}

private fun libraryFiles(javaBase: Path): List<Path> {
    val jars = listOf(
        kotlinx.serialization.json.Json::class.java,
        kotlinx.serialization.KSerializer::class.java,
        kotlin.Unit::class.java,
        Class.forName("androidx.compose.runtime.internal.StabilityInferred"),
        Class.forName("org.jetbrains.annotations.NotNull"),
    ).mapNotNull { type ->
        val url = type.protectionDomain?.codeSource?.location ?: return@mapNotNull null
        File(url.toURI()).takeIf { it.isFile }?.toPath()
    }.distinct()
    check(jars.any { it.fileName.toString().contains("serialization") }) {
        "kotlinx-serialization jars are not visible to the test class loader"
    }
    return jars + listOf(javaBase)
}

private fun javaBaseJar(destination: Path) {
    val jmod = File(System.getProperty("java.home"), "jmods/java.base.jmod")
    check(jmod.isFile) { "Missing $jmod" }
    ZipFile(jmod).use { zip ->
        JarOutputStream(Files.newOutputStream(destination)).use { jar ->
            val entries = zip.entries()
            while (entries.hasMoreElements()) {
                val entry = entries.nextElement()
                if (entry.isDirectory || !entry.name.startsWith("classes/") || !entry.name.endsWith(".class")) continue
                jar.putNextEntry(JarEntry(entry.name.removePrefix("classes/")))
                zip.getInputStream(entry).use { it.copyTo(jar) }
                jar.closeEntry()
            }
        }
    }
}
