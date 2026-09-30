package com.dhama.mybase.core.network

import com.dhama.mybase.core.model.SavedCompanion
import com.dhama.mybase.core.voice.resolveVoiceUrl
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.time.Instant

@Serializable
data class RemoteAvatarSummary(
    val id: Int,
    val name: String = "",
)

@Serializable
data class RemoteAvatar(
    val id: Int,
    val name: String = "",
    val greeting: String? = null,
    val systemPrompt: String? = null,
    val createdAt: String? = null,
    val appearance: RemoteAppearance? = null,
    val personality: RemotePersonality? = null,
    val voice: RemoteVoice? = null,
)

@Serializable
data class RemoteAppearance(
    val hairColor: String? = null,
    val eyeColor: String? = null,
    val skinTone: String? = null,
    val avatarUrl: String? = null,
    val metadata: JsonObject? = null,
)

@Serializable
data class RemotePersonality(
    val traits: JsonElement? = null,
    val humorLevel: Int? = null,
    val flirtLevel: Int? = null,
    val empathyLevel: Int? = null,
    val romanceLevel: Int? = null,
    val metadata: JsonObject? = null,
)

@Serializable
data class RemoteVoice(
    val voiceId: String? = null,
)

@Serializable
data class RemoteAvatarUpload(
    val avatarUrl: String = "",
)

@Serializable
data class RemoteConversation(
    val id: Int,
    val companionId: Int = 0,
    val title: String? = null,
)

@Serializable
data class RemoteMessage(
    val id: Int,
    val role: String = "USER",
    val type: String = "TEXT",
    val content: String? = null,
    val audioUrl: String? = null,
    val imageUrl: String? = null,
    val createdAt: String? = null,
)

@Serializable
data class RemoteMemory(
    val id: Int,
    val type: String = "FACT",
    val content: String = "",
    val importance: Int = 0,
    val confidence: Double = 1.0,
    val source: String = "USER_INPUT",
    val createdAt: String? = null,
    val updatedAt: String? = null,
)

data class RestoredMessage(
    val id: String,
    val role: String,
    val text: String,
    val createdAtEpochMs: Long,
    val kind: String,
    val audioPath: String,
)

data class RestoredMemory(
    val id: String,
    val type: String,
    val content: String,
    val importance: Int,
    val confidence: Float,
    val source: String,
    val createdAtEpochMs: Long,
    val updatedAtEpochMs: Long,
)

fun serverLocalId(serverId: Int): String = "server-$serverId"

fun serverRecordId(localId: String): Int? {
    if (!localId.startsWith("server-")) return null
    return localId.removePrefix("server-").toIntOrNull()
}

enum class MemoryForget {
    Local,
    Server,
    Keep,
}

/** A phone-only memory can be dropped locally. A server row needs the API, and stays if there is no session. */
fun memoryForgetAction(localId: String, hasSession: Boolean): MemoryForget {
    if (serverRecordId(localId) == null) return MemoryForget.Local
    return if (hasSession) MemoryForget.Server else MemoryForget.Keep
}

fun displayNameError(name: String): String? {
    val length = name.trim().length
    return when {
        length < 2 -> "Your name needs at least 2 characters"
        length > 100 -> "Keep your name under 100 characters"
        else -> null
    }
}

@Serializable
data class RemoteUser(
    val email: String? = null,
    val displayName: String? = null,
)

fun epochMillis(value: String?): Long {
    if (value.isNullOrBlank()) return 0L
    return runCatching { Instant.parse(value).toEpochMilli() }.getOrDefault(0L)
}

fun stringList(element: JsonElement?): List<String> {
    val array = element as? JsonArray ?: return emptyList()
    return array.mapNotNull { (it as? JsonPrimitive)?.contentOrNull?.takeIf { text -> text.isNotBlank() } }
}

const val AVATAR_MAX_BYTES = 5L * 1024 * 1024

fun avatarPhotoError(mime: String?, sizeBytes: Long): String? {
    val type = mime?.substringBefore(';')?.trim()?.lowercase().orEmpty()
    val allowed = type == "image/jpeg" || type == "image/png" || type == "image/webp"
    if (!allowed) return "Use a JPEG, PNG, or WebP image."
    if (sizeBytes > AVATAR_MAX_BYTES) {
        val megabytes = sizeBytes / (1024.0 * 1024.0)
        return "That image is ${"%.1f".format(java.util.Locale.US, megabytes)}MB. The limit is 5MB."
    }
    return null
}

fun avatarFileName(mime: String): String {
    return when (mime.substringBefore(';').trim().lowercase()) {
        "image/png" -> "avatar.png"
        "image/webp" -> "avatar.webp"
        else -> "avatar.jpg"
    }
}

fun RemoteAvatar.toSaved(conversationId: Int, nowEpochMs: Long, origin: String = ""): SavedCompanion {
    val relationship = text(personality?.metadata, "relationshipType") ?: "Girlfriend"
    val style = text(appearance?.metadata, "style") ?: "Realistic"
    val voiceId = voice?.voiceId?.takeIf { it.isNotBlank() } ?: "warm"
    val safeName = name.ifBlank { "Companion" }
    return SavedCompanion(
        name = safeName,
        traits = stringList(personality?.traits).take(4),
        voiceLabel = voiceId.replaceFirstChar { char -> char.uppercase() },
        relationship = relationship,
        greeting = greeting?.takeIf { it.isNotBlank() } ?: "Hi — I'm $safeName.",
        style = style,
        systemPrompt = systemPrompt.orEmpty(),
        createdAtEpochMs = epochMillis(createdAt).takeIf { it > 0 } ?: nowEpochMs,
        hairColor = appearance?.hairColor?.takeIf { it.isNotBlank() } ?: "Brown",
        eyeColor = appearance?.eyeColor?.takeIf { it.isNotBlank() } ?: "Blue",
        skinTone = appearance?.skinTone?.takeIf { it.isNotBlank() } ?: "Warm",
        empathyLevel = personality?.empathyLevel ?: 82,
        humorLevel = personality?.humorLevel ?: 64,
        flirtLevel = personality?.flirtLevel ?: 45,
        romanceLevel = personality?.romanceLevel ?: 58,
        serverId = id,
        conversationId = conversationId,
        avatarUrl = appearance?.avatarUrl
            ?.takeIf { it.isNotBlank() }
            ?.let { resolveVoiceUrl(origin, it) }
            .orEmpty(),
    )
}

fun RemoteMessage.toRestored(origin: String): RestoredMessage {
    val kind = when {
        type == "IMAGE" || !imageUrl.isNullOrBlank() -> "IMAGE"
        type == "AUDIO" || !audioUrl.isNullOrBlank() -> "AUDIO"
        else -> "TEXT"
    }
    val media = when (kind) {
        "IMAGE" -> imageUrl
        "AUDIO" -> audioUrl
        else -> null
    }
    return RestoredMessage(
        id = serverLocalId(id),
        role = role.ifBlank { "USER" },
        text = content.orEmpty(),
        createdAtEpochMs = epochMillis(createdAt),
        kind = kind,
        audioPath = media?.takeIf { it.isNotBlank() }?.let { resolveVoiceUrl(origin, it) }.orEmpty(),
    )
}

fun RemoteMemory.toRestored(nowEpochMs: Long): RestoredMemory {
    val created = epochMillis(createdAt).takeIf { it > 0 } ?: nowEpochMs
    return RestoredMemory(
        id = serverLocalId(id),
        type = type.ifBlank { "FACT" },
        content = content,
        importance = importance.coerceIn(0, 100),
        confidence = confidence.toFloat().coerceIn(0f, 1f),
        source = source.ifBlank { "USER_INPUT" },
        createdAtEpochMs = created,
        updatedAtEpochMs = epochMillis(updatedAt).takeIf { it > 0 } ?: created,
    )
}

private fun text(obj: JsonObject?, key: String): String? {
    return (obj?.get(key) as? JsonPrimitive)?.contentOrNull?.takeIf { it.isNotBlank() }
}
