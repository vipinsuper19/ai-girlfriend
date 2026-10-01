# Keep kotlinx.serialization generated serializers.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keep,includedescriptorclasses class com.aicompanion.**$$serializer { *; }
-keepclassmembers class com.aicompanion.** {
    *** Companion;
}
