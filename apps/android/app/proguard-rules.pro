# Release shrinking uses R8 (minify + shrinkResources).
# These rules sit on top of the consumer rules shipped by the libraries.
# R8 writes outputs/mapping/release/mapping.txt. The Crashlytics Gradle plugin uploads it
# unless the build passes -PdisableMappingUpload=true or -PallowPlaceholderApi=true.

# Stack traces stay mappable. SourceFile is renamed so original paths are not baked in.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
-keep public class com.dhama.mybase.** extends java.lang.Exception
-dontwarn com.google.firebase.crashlytics.**

# Generic signatures and annotations. kotlinx.serialization reads these.
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

# --- OkHttp ---
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
-adaptresourcefilenames okhttp3/internal/publicsuffix/PublicSuffixDatabase.gz

# --- Hilt / Dagger ---
# The Hilt Gradle plugin supplies the rules for dagger.hilt and javax.inject.
-keep class * extends dagger.hilt.android.internal.managers.ViewComponentManager$FragmentContextWrapper { *; }
-keepnames @dagger.hilt.android.lifecycle.HiltViewModel class *
-keep class * implements dagger.hilt.internal.GeneratedComponent
-keep class * implements dagger.hilt.internal.GeneratedComponentManager
-keep class * implements dagger.hilt.internal.GeneratedComponentManagerHolder

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
