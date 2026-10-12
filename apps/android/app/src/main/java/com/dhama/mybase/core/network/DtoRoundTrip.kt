package com.dhama.mybase.core.network

import com.dhama.mybase.core.age.RegisterRequest
import com.dhama.mybase.core.model.AppearanceRequest
import com.dhama.mybase.core.model.CreateAvatarRequest
import com.dhama.mybase.core.model.PersonalityRequest
import com.dhama.mybase.core.model.VoiceRequest
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.JsonPrimitive

/**
 * Encodes and decodes the API DTOs release shrinking must leave readable.
 * The unit smoke test runs this again after R8. Nothing else calls it, so the
 * release shrinker removes the fixture itself.
 */
object DtoRoundTrip {
    fun payload(): String {
        val json = apiJson()
        val avatar = CreateAvatarRequest(
            name = "Aria",
            gender = "FEMALE",
            systemPrompt = "Be kind",
            greeting = "Hi",
            appearance = AppearanceRequest(hairColor = "Brown", eyeColor = "Blue"),
            personality = PersonalityRequest(
                traits = listOf("Caring", "Playful"),
                humorLevel = 10,
                flirtLevel = 20,
                empathyLevel = 30,
                romanceLevel = 40,
                metadata = mapOf("relationship" to "Girlfriend"),
            ),
            voice = VoiceRequest(provider = "default", voiceId = "warm", language = "en"),
        )
        val avatarWire = json.encodeToString(avatar)
        val avatarBack = json.decodeFromString<CreateAvatarRequest>(avatarWire)

        val tokens = json.decodeFromString<SessionTokens>("""{"accessToken":"a","refreshToken":"r"}""")
        val usage = json.decodeFromString<RemoteUsageSummary>(
            """{"plan":"PREMIUM","period":{"start":"2026-10-01T00:00:00Z","end":"2026-11-01T00:00:00Z"},"usage":[{"feature":"MESSAGES","used":3,"limit":100,"remaining":97}]}""",
        )
        val register = RegisterRequest(
            email = "a@b.co",
            password = "secret",
            displayName = "Ann",
            dateOfBirth = "1991-03-17",
            ageConfirmedAt = "2026-10-12T15:04:05Z",
        )
        val registerWire = json.encodeToString(register)
        val registerBack = json.decodeFromString<RegisterRequest>(registerWire)
        val message = json.decodeFromString<RemoteMessage>(
            """{"id":7,"role":"ASSISTANT","type":"TEXT","content":"Hello","imageUrl":"https://cdn.example/a.png","createdAt":"2026-10-12T15:04:05Z"}""",
        )
        val remote = json.decodeFromString<RemoteAvatar>(
            """{"id":4,"name":"Aria","greeting":"Hi","gender":"FEMALE","appearance":{"hairColor":"Brown","metadata":{"style":"Realistic"}},"personality":{"humorLevel":10},"voice":{"voiceId":"warm"}}""",
        )
        val line = usage.usage.single()
        return listOf(
            avatarWire,
            avatarBack.name,
            avatarBack.appearance.hairColor,
            avatarBack.personality.traits.joinToString(","),
            avatarBack.personality.metadata["relationship"],
            avatarBack.voice.voiceId,
            tokens.accessToken,
            tokens.refreshToken,
            json.encodeToString(tokens),
            usage.plan,
            usage.period?.start,
            line.feature,
            line.used.toString(),
            line.limit?.toString(),
            registerWire,
            registerBack.email,
            registerBack.dateOfBirth,
            message.content,
            message.imageUrl,
            message.role,
            remote.name,
            remote.appearance?.hairColor,
            (remote.appearance?.metadata?.get("style") as? JsonPrimitive)?.content,
            remote.personality?.humorLevel?.toString(),
            remote.voice?.voiceId,
        ).joinToString("\n")
    }
}

/** Present only so the shrinker smoke test can see R8 delete an unused class. */
internal class ReleaseShrinkCanary
