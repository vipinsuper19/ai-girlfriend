package com.dhama.mybase.core.network

import com.dhama.mybase.core.model.SavedCompanion
import com.dhama.mybase.core.model.companionGender
import com.dhama.mybase.core.model.present
import com.dhama.mybase.core.usage.PlanUsage
import com.dhama.mybase.core.voice.resolveVoiceUrl
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
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
    val gender: String? = null,
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
    val ethnicity: String? = null,
    val bodyType: String? = null,
    val height: String? = null,
    val clothingStyle: String? = null,
    val hairStyle: String? = null,
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
data class RemoteLastMessage(
    val id: Int = 0,
    val role: String = "",
    val type: String = "TEXT",
    val content: String? = null,
)

@Serializable
data class RemoteConversation(
    val id: Int,
    val companionId: Int = 0,
    val title: String? = null,
    val lastMessageAt: String? = null,
    val lastMessage: RemoteLastMessage? = null,
)

private const val PREVIEW_CHARS = 80

const val ARCHIVE_NOTICE =
    "She leaves the app. Conversations and memories are kept, and you can bring her back."

fun bringBackLabel(name: String): String {
    val clean = name.trim().ifBlank { "her" }
    return "Bring $clean back"
}

fun conversationTitle(title: String?, companionName: String): String {
    val clean = title?.trim().orEmpty()
    return clean.ifBlank { companionName.trim().ifBlank { "Conversation" } }
}

/** One line under the history title. Blank voice and image lines get a short label. */
fun conversationPreview(message: RemoteLastMessage?): String {
    if (message == null) return ""
    val text = message.content?.replace(Regex("\\s+"), " ")?.trim().orEmpty()
    if (text.isNotEmpty()) {
        if (text.length <= PREVIEW_CHARS) return text
        return text.take(PREVIEW_CHARS).trimEnd() + "…"
    }
    return when (message.type.trim().uppercase()) {
        "AUDIO" -> "Voice note"
        "IMAGE" -> "Photo"
        else -> ""
    }
}

fun relativeChatTime(epochMs: Long, nowMs: Long): String {
    if (epochMs <= 0L) return ""
    val delta = (nowMs - epochMs).coerceAtLeast(0L)
    val minute = 60_000L
    val hour = 60 * minute
    val day = 24 * hour
    return when {
        delta < minute -> "Just now"
        delta < hour -> "${delta / minute} min ago"
        delta < day -> "${delta / hour} hr ago"
        delta < 7 * day -> "${delta / day} d ago"
        else -> java.time.Instant.ofEpochMilli(epochMs)
            .atZone(java.time.ZoneOffset.UTC)
            .format(java.time.format.DateTimeFormatter.ofPattern("d MMM", java.util.Locale.US))
    }
}

@Serializable
data class PostedMessages(
    val userMessage: RemoteMessage? = null,
    val assistantMessage: RemoteMessage? = null,
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

/** Local rows always go. Server rows go after the bulk delete succeeds. */
fun memoriesToForget(ids: List<String>, hasSession: Boolean, serverCleared: Boolean): List<String> {
    return ids.filter { id ->
        when (memoryForgetAction(id, hasSession)) {
            MemoryForget.Local -> true
            MemoryForget.Keep -> false
            MemoryForget.Server -> serverCleared
        }
    }
}

fun passwordChangeError(current: String, next: String): String? {
    return when {
        current.isEmpty() -> "Enter your current password."
        next.length < 8 -> "Use at least 8 characters."
        next.length > 128 -> "Keep the password under 128 characters."
        current == next -> "Choose a different password."
        else -> null
    }
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

@Serializable
data class RemoteSubscription(
    val plan: String = "FREE",
    val status: String = "",
)

@Serializable
data class RemoteUsageLine(
    val feature: String = "",
    val used: Int = 0,
    val limit: Int? = null,
    val remaining: Int? = null,
)

@Serializable
data class RemoteUsagePeriod(
    val start: String? = null,
    val end: String? = null,
)

@Serializable
data class RemoteUsageSummary(
    val plan: String = "FREE",
    val period: RemoteUsagePeriod? = null,
    val usage: List<RemoteUsageLine> = emptyList(),
)

fun planUsage(summary: RemoteUsageSummary): PlanUsage {
    fun line(feature: String) = summary.usage.firstOrNull { it.feature == feature }
    val messages = line("MESSAGES")
    val voice = line("VOICE_MINUTES")
    val images = line("IMAGE_GENERATIONS")
    return PlanUsage(
        messagesUsed = messages?.used ?: 0,
        messagesLimit = messages?.limit,
        voiceUsed = voice?.used ?: 0,
        voiceLimit = voice?.limit,
        imagesUsed = images?.used ?: 0,
        imagesLimit = images?.limit,
        periodStartEpochMs = epochMillis(summary.period?.start),
        resetEpochMs = epochMillis(summary.period?.end),
        fromServer = true,
    )
}

fun parseUsageSummary(raw: String): PlanUsage? {
    if (raw.isBlank()) return null
    return runCatching { planUsage(apiJson().decodeFromString<RemoteUsageSummary>(raw)) }.getOrNull()
}

fun planLabel(plan: String): String = when (plan.trim().uppercase()) {
    "PREMIUM" -> "Premium"
    "PREMIUM_PLUS" -> "Premium Plus"
    "FREE", "" -> "Free"
    else -> plan.trim()
}

fun planCardStatus(cardTitle: String, currentLabel: String): String {
    val current = currentLabel.ifBlank { "Free" }
    return if (cardTitle == current) "Current plan" else "Read only"
}

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
        ethnicity = appearance?.ethnicity.present(),
        bodyType = appearance?.bodyType.present(),
        height = appearance?.height.present(),
        clothingStyle = appearance?.clothingStyle.present(),
        hairStyle = appearance?.hairStyle.present(),
        empathyLevel = personality?.empathyLevel ?: 82,
        humorLevel = personality?.humorLevel ?: 64,
        flirtLevel = personality?.flirtLevel ?: 45,
        romanceLevel = personality?.romanceLevel ?: 58,
        serverId = id,
        conversationId = conversationId,
        gender = companionGender(gender),
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
