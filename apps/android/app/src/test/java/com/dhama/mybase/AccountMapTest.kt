package com.dhama.mybase

import com.dhama.mybase.core.network.AVATAR_MAX_BYTES
import com.dhama.mybase.core.network.MemoryForget
import com.dhama.mybase.core.network.avatarFileName
import com.dhama.mybase.core.network.avatarPhotoError
import com.dhama.mybase.core.network.RemoteAppearance
import com.dhama.mybase.core.network.RemoteAvatar
import com.dhama.mybase.core.network.RemoteAvatarSummary
import com.dhama.mybase.core.network.RemoteMemory
import com.dhama.mybase.core.network.RemoteMessage
import com.dhama.mybase.core.network.RemotePersonality
import com.dhama.mybase.core.network.RemoteUser
import com.dhama.mybase.core.network.decodeDataList
import com.dhama.mybase.core.network.displayNameError
import com.dhama.mybase.core.network.epochMillis
import com.dhama.mybase.core.network.memoryForgetAction
import com.dhama.mybase.core.network.serverLocalId
import com.dhama.mybase.core.network.serverRecordId
import com.dhama.mybase.core.network.toRestored
import com.dhama.mybase.core.network.toSaved
import com.dhama.mybase.core.network.unwrapData
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AccountMapTest {

    @Test
    fun epochAndServerIds() {
        assertEquals(1_740_960_000_000L, epochMillis("2025-03-03T00:00:00Z"))
        assertEquals(0L, epochMillis(null))
        assertEquals(0L, epochMillis("not-a-date"))
        assertEquals("server-7", serverLocalId(7))
        assertEquals(7, serverRecordId("server-7"))
        assertNull(serverRecordId("greeting"))
        assertNull(serverRecordId("server-x"))
    }

    @Test
    fun savedCompanionKeepsRelationshipStyleAndLevelDefaults() {
        val saved = RemoteAvatar(
            id = 4,
            name = "Aria",
            personality = RemotePersonality(
                traits = JsonArray(listOf(JsonPrimitive("Caring"), JsonPrimitive("Playful"))),
                metadata = JsonObject(mapOf("relationshipType" to JsonPrimitive("Partner"))),
            ),
            appearance = RemoteAppearance(
                hairColor = "Black",
                metadata = JsonObject(mapOf("style" to JsonPrimitive("Anime"))),
            ),
        ).toSaved(conversationId = 9, nowEpochMs = 1_700_000_000_000)
        assertEquals("Partner", saved.relationship)
        assertEquals("Anime", saved.style)
        assertEquals(listOf("Caring", "Playful"), saved.traits)
        assertEquals(82, saved.empathyLevel)
        assertEquals(64, saved.humorLevel)
        assertEquals(45, saved.flirtLevel)
        assertEquals(58, saved.romanceLevel)
        assertEquals("Warm", saved.voiceLabel)
        assertEquals("Black", saved.hairColor)
        assertEquals(4, saved.serverId)
        assertEquals(9, saved.conversationId)
        assertEquals("Hi — I'm Aria.", saved.greeting)
    }

    @Test
    fun messageAudioResolvesAgainstTheOrigin() {
        val restored = RemoteMessage(
            id = 12,
            role = "ASSISTANT",
            type = "AUDIO",
            content = "hello",
            audioUrl = "/uploads/voice/a.m4a",
            createdAt = "2025-03-01T00:00:00Z",
        ).toRestored("http://10.0.2.2:3001")
        assertEquals("server-12", restored.id)
        assertEquals("AUDIO", restored.kind)
        assertEquals("http://10.0.2.2:3001/uploads/voice/a.m4a", restored.audioPath)
        assertEquals(epochMillis("2025-03-01T00:00:00Z"), restored.createdAtEpochMs)
    }

    @Test
    fun memoryKeepsTheServerImportance() {
        val restored = RemoteMemory(
            id = 3,
            type = "PREFERENCE",
            content = "likes tea",
            importance = 8,
            confidence = 1.5,
        ).toRestored(1_000)
        assertEquals("server-3", restored.id)
        assertEquals(8, restored.importance)
        assertEquals(1f, restored.confidence)
        assertEquals(1_000L, restored.createdAtEpochMs)
    }

    @Test
    fun decodeDataListReadsAnArray() {
        val list = decodeDataList<RemoteAvatarSummary>(
            """{"success":true,"data":[{"id":1,"name":"Aria"},{"id":2}]}""",
        )
        assertEquals(2, list.size)
        assertEquals("Aria", list[0].name)
        assertEquals(2, list[1].id)
        assertEquals(0, decodeDataList<RemoteAvatarSummary>("""{"data":[]}""").size)
    }

    @Test
    fun forgetsPhoneMemoriesLocallyAndKeepsServerRowsOffline() {
        assertEquals(MemoryForget.Local, memoryForgetAction("uuid", hasSession = true))
        assertEquals(MemoryForget.Server, memoryForgetAction("server-4", hasSession = true))
        assertEquals(MemoryForget.Keep, memoryForgetAction("server-4", hasSession = false))
    }

    @Test
    fun displayNameMatchesTheServerLength() {
        assertEquals("Your name needs at least 2 characters", displayNameError("A"))
        assertNull(displayNameError("Al"))
        assertEquals("Keep your name under 100 characters", displayNameError("a".repeat(101)))
    }

    @Test
    fun readsTheAccountEnvelope() {
        val user = unwrapData<RemoteUser>(
            """{"data":{"id":3,"email":"aria@example.com","displayName":"Aria","passwordHash":"secret"}}""",
        )
        assertEquals("Aria", user.displayName)
        assertEquals("aria@example.com", user.email)
    }

    @Test
    fun photoRulesMatchTheUploadLimit() {
        assertNull(avatarPhotoError("image/jpeg", AVATAR_MAX_BYTES))
        assertEquals("Use a JPEG, PNG, or WebP image.", avatarPhotoError("image/gif", 100))
        assertEquals("That image is 6.0MB. The limit is 5MB.", avatarPhotoError("image/png", 6L * 1024 * 1024))
        assertEquals("avatar.webp", avatarFileName("image/webp"))
    }

    @Test
    fun avatarUrlResolvesAgainstTheOrigin() {
        val saved = RemoteAvatar(
            id = 4,
            name = "Aria",
            appearance = RemoteAppearance(avatarUrl = "/uploads/companions/4.jpg"),
        ).toSaved(conversationId = 9, nowEpochMs = 1L, origin = "http://10.0.2.2:3001")
        assertEquals("http://10.0.2.2:3001/uploads/companions/4.jpg", saved.avatarUrl)
    }
}
