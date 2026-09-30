package com.dhama.mybase.core.model

import kotlinx.serialization.Serializable

/**
 * Local wizard draft. Field names match CreateAvatarDto in apps/api:
 * appearance, personality, and voice are nested objects; relationship has no
 * column and is stored in personality.metadata.
 */
@Serializable
data class CompanionDraft(
    val style: String = "Realistic",
    val hairColor: String = "Brown",
    val eyeColor: String = "Blue",
    val skinTone: String = "Warm",
    val ethnicity: String? = null,
    val bodyType: String? = null,
    val height: String? = null,
    val clothingStyle: String? = null,
    val hairStyle: String? = null,
    val traits: List<String> = listOf("Caring", "Playful", "Curious"),
    val empathyLevel: Int = 82,
    val humorLevel: Int = 64,
    val flirtLevel: Int = 45,
    val romanceLevel: Int = 58,
    val voiceId: String = "warm",
    val voiceLabel: String = "Warm",
    val relationship: String = "Girlfriend",
    val name: String = "",
    val gender: String = "FEMALE",
) {
    fun normalizedName(): String = name.trim()

    fun nameError(): String? {
        val length = normalizedName().length
        return when {
            length < 2 -> "Her name needs at least 2 characters"
            length > 100 -> "Keep her name under 100 characters"
            else -> null
        }
    }

    fun toggleTrait(trait: String): CompanionDraft {
        val next = when {
            trait in traits -> traits - trait
            traits.size >= MAX_TRAITS -> traits
            else -> traits + trait
        }
        return copy(traits = next)
    }

    fun systemPrompt(): String {
        val traitLine = if (traits.isEmpty()) "warm and attentive" else traits.joinToString(", ")
        val who = normalizedName().ifBlank { "a companion" }
        return buildString {
            append("You are $who, ${genderPhrase(gender)}, ")
            append("the user's $relationship. ")
            append("Your traits: $traitLine. ")
            append("Warmth $empathyLevel, humour $humorLevel, flirtiness $flirtLevel, romance $romanceLevel, on a 0–100 scale. ")
            append("Look: $style style, $hairColor hair, $eyeColor eyes, $skinTone skin. ")
            append("Speak in a ${voiceLabel.lowercase()} voice. ")
            append("Remember what matters, and never invent memories the user did not share.")
        }
    }

    fun greeting(): String {
        val who = normalizedName().ifBlank { "here" }
        return "Hi — I'm $who. I don't know anything about you yet, and I'd like to."
    }

    fun toCreateRequest(): CreateAvatarRequest {
        val cleanName = normalizedName()
        return CreateAvatarRequest(
            name = cleanName,
            gender = companionGender(gender),
            systemPrompt = systemPrompt(),
            greeting = greeting(),
            appearance = AppearanceRequest(
                ethnicity = ethnicity,
                skinTone = skinTone,
                hairColor = hairColor,
                hairStyle = hairStyle,
                eyeColor = eyeColor,
                bodyType = bodyType,
                height = height,
                clothingStyle = clothingStyle,
                imagePrompt = "$style portrait, $hairColor hair, $eyeColor eyes, $skinTone skin",
                metadata = mapOf("style" to style),
            ),
            personality = PersonalityRequest(
                traits = traits,
                humorLevel = humorLevel,
                flirtLevel = flirtLevel,
                empathyLevel = empathyLevel,
                romanceLevel = romanceLevel,
                metadata = mapOf("relationshipType" to relationship),
            ),
            voice = VoiceRequest(
                provider = "default",
                voiceId = voiceId,
                language = "en",
            ),
        )
    }

    fun toSaved(createdAtEpochMs: Long): SavedCompanion {
        val request = toCreateRequest()
        return SavedCompanion(
            name = request.name,
            traits = traits,
            voiceLabel = voiceLabel,
            relationship = relationship,
            greeting = request.greeting,
            style = style,
            systemPrompt = request.systemPrompt,
            createdAtEpochMs = createdAtEpochMs,
            hairColor = hairColor,
            eyeColor = eyeColor,
            skinTone = skinTone,
            empathyLevel = empathyLevel,
            humorLevel = humorLevel,
            flirtLevel = flirtLevel,
            romanceLevel = romanceLevel,
            gender = companionGender(gender),
        )
    }

    companion object {
        const val MAX_TRAITS = 4
    }
}

@Serializable
data class SavedCompanion(
    val name: String,
    val traits: List<String>,
    val voiceLabel: String,
    val relationship: String,
    val greeting: String,
    val style: String,
    val systemPrompt: String,
    val createdAtEpochMs: Long,
    val hairColor: String = "Brown",
    val eyeColor: String = "Blue",
    val skinTone: String = "Warm",
    val empathyLevel: Int = 82,
    val humorLevel: Int = 64,
    val flirtLevel: Int = 45,
    val romanceLevel: Int = 58,
    val serverId: Int? = null,
    val conversationId: Int? = null,
    val avatarUrl: String = "",
    val gender: String = "FEMALE",
)

@Serializable
data class CreateAvatarRequest(
    val name: String,
    val gender: String,
    val systemPrompt: String,
    val greeting: String,
    val appearance: AppearanceRequest,
    val personality: PersonalityRequest,
    val voice: VoiceRequest,
)

@Serializable
data class AppearanceRequest(
    val ethnicity: String? = null,
    val skinTone: String? = null,
    val hairColor: String? = null,
    val hairStyle: String? = null,
    val eyeColor: String? = null,
    val bodyType: String? = null,
    val height: String? = null,
    val clothingStyle: String? = null,
    val imagePrompt: String? = null,
    val avatarUrl: String? = null,
    val metadata: Map<String, String> = emptyMap(),
)

@Serializable
data class PersonalityRequest(
    val traits: List<String>,
    val humorLevel: Int,
    val flirtLevel: Int,
    val empathyLevel: Int,
    val romanceLevel: Int,
    val metadata: Map<String, String> = emptyMap(),
)

@Serializable
data class VoiceRequest(
    val provider: String,
    val voiceId: String,
    val language: String,
)

fun companionGender(value: String?): String = when (value?.trim()?.uppercase()) {
    "MALE" -> "MALE"
    "OTHER" -> "OTHER"
    else -> "FEMALE"
}

fun genderLabel(value: String?): String = when (companionGender(value)) {
    "MALE" -> "Man"
    "OTHER" -> "Non-binary"
    else -> "Woman"
}

val relationshipOptions = listOf("Girlfriend", "Partner", "Close friend", "Confidante")

val lookStyles = listOf("Realistic", "Illustrated", "Anime")
val hairColors = listOf("Black", "Brown", "Auburn", "Blonde", "Copper")
val eyeColors = listOf("Brown", "Green", "Blue", "Hazel", "Grey")
val skinTones = listOf("Fair", "Warm", "Olive", "Deep")

val voiceChoices = listOf(
    "soft" to "Soft",
    "warm" to "Warm",
    "bright" to "Bright",
    "calm" to "Calm",
)

fun voiceIdFor(label: String): String {
    val match = voiceChoices.firstOrNull { it.second.equals(label.trim(), ignoreCase = true) }
    return match?.first ?: "warm"
}

fun genderPhrase(value: String?): String = when (companionGender(value)) {
    "MALE" -> "a man"
    "OTHER" -> "a person"
    else -> "a woman"
}
