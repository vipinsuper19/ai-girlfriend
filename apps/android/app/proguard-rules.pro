# Release shrinking uses R8 (minify + shrinkResources).
# These rules sit on top of the consumer rules shipped by the libraries.
# R8 writes outputs/mapping/release/mapping.txt for Crashlytics. Nothing uploads that file.

# Stack traces stay mappable. SourceFile is renamed so original paths are not baked in.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
-keep public class * extends java.lang.Exception
-dontwarn com.google.firebase.crashlytics.**

# Generic signatures and annotations. Retrofit, Gson, and kotlinx.serialization read these.
-keepattributes Signature,InnerClasses,EnclosingMethod
-keepattributes RuntimeVisibleAnnotations,RuntimeVisibleParameterAnnotations,AnnotationDefault

# --- kotlinx.serialization (API DTOs and Navigation routes) ---
# Official rules for kotlinx-serialization 1.11. JSON names live in the generated
# $$serializer descriptors, so those classes and Companion.serializer() must stay.

-keepclassmembers @kotlinx.serialization.Serializable class ** {
    static ** Companion;
}

-if @kotlinx.serialization.internal.NamedCompanion class *
-keepclassmembers class * {
    static <1> *;
}

-if @kotlinx.serialization.Serializable class ** {
    static **$* *;
}
-keepclassmembers class <2>$<3> {
    kotlinx.serialization.KSerializer serializer(...);
}

-if @kotlinx.serialization.Serializable class ** {
    public static ** INSTANCE;
}
-keepclassmembers class <1> {
    public static <1> INSTANCE;
    kotlinx.serialization.KSerializer serializer(...);
}

-keepclassmembers public class **$$serializer {
    private ** descriptor;
}

-dontnote kotlinx.serialization.**
-dontwarn kotlinx.serialization.internal.ClassValueReferences

# App serializers, including private request bodies in ApiClient.
-keep class com.dhama.mybase.**$$serializer { *; }
-keepclassmembers class com.dhama.mybase.**$Companion {
    kotlinx.serialization.KSerializer serializer(...);
}

# Type-safe Navigation routes use the serial name as the route.
-keepnames class com.dhama.mybase.core.navigation.**

# --- Retrofit + Gson ---
# The app speaks JSON through kotlinx.serialization. Retrofit and converter-gson
# are on the classpath and reflect on service methods and @SerializedName fields.

-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
-if interface * { @retrofit2.http.* <methods>; }
-keep,allowobfuscation interface <1>
-if interface * { @retrofit2.http.* <methods>; }
-keep,allowobfuscation interface * extends <1>
-if interface * { @retrofit2.http.* public *** *(...); }
-keep,allowoptimization,allowshrinking,allowobfuscation class <3>
-keep,allowobfuscation,allowshrinking class kotlin.coroutines.Continuation
-keep,allowobfuscation,allowshrinking class retrofit2.Response
-dontwarn org.codehaus.mojo.animal_sniffer.**
-dontwarn javax.annotation.**
-dontwarn kotlin.Unit
-dontwarn retrofit2.KotlinExtensions
-dontwarn retrofit2.KotlinExtensions$*

-if class com.google.gson.reflect.TypeToken
-keep,allowobfuscation class com.google.gson.reflect.TypeToken
-keep,allowobfuscation class * extends com.google.gson.reflect.TypeToken
-keep,allowobfuscation,allowoptimization @com.google.gson.annotations.JsonAdapter class *
-keepclassmembers,allowobfuscation class * {
    @com.google.gson.annotations.Expose <fields>;
    @com.google.gson.annotations.JsonAdapter <fields>;
    @com.google.gson.annotations.Since <fields>;
    @com.google.gson.annotations.Until <fields>;
    @com.google.gson.annotations.SerializedName <fields>;
}
-keepclassmembers class * extends com.google.gson.TypeAdapter {
    <init>();
}
-keepclassmembers class * implements com.google.gson.TypeAdapterFactory {
    <init>();
}
-keepclassmembers class * implements com.google.gson.JsonSerializer {
    <init>();
}
-keepclassmembers class * implements com.google.gson.JsonDeserializer {
    <init>();
}
-if class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-keepclasseswithmembers,allowobfuscation class <1> {
    @com.google.gson.annotations.SerializedName <fields>;
}
-if class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-keepclassmembers,allowobfuscation,allowoptimization class <1> {
    <init>();
}

# --- OkHttp ---
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
-adaptresourcefilenames okhttp3/internal/publicsuffix/PublicSuffixDatabase.gz

# --- Hilt / Dagger ---
# The Hilt Gradle plugin also injects rules for generated components.
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }
-keep class * extends dagger.hilt.android.internal.managers.ViewComponentManager$FragmentContextWrapper { *; }
-keepnames @dagger.hilt.android.lifecycle.HiltViewModel class *
-keep class * implements dagger.hilt.internal.GeneratedComponent
-keep class * implements dagger.hilt.internal.GeneratedComponentManager
-keep class * implements dagger.hilt.internal.GeneratedComponentManagerHolder
-keepclasseswithmembers,allowobfuscation class * {
    @dagger.Module <methods>;
    @dagger.Provides <methods>;
    @javax.inject.Inject <init>(...);
    @javax.inject.Inject <fields>;
}

# --- Firebase ---
-keep class com.google.firebase.components.ComponentDiscovery { *; }
-keep class com.google.firebase.provider.FirebaseInitProvider
-keep class * implements com.google.firebase.components.ComponentRegistrar
-keep class com.google.firebase.messaging.FirebaseMessagingService { *; }
-keep class com.dhama.mybase.core.push.PushService { *; }
-keep class com.dhama.mybase.BaseApplication
-keep class com.dhama.mybase.MainActivity

# --- Room ---
-keep class com.dhama.mybase.core.db.** { *; }
-keep class * extends androidx.room.RoomDatabase { *; }
