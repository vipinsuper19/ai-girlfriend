package com.dhama.mybase

import com.dhama.mybase.core.network.AVATAR_MAX_BYTES
import com.dhama.mybase.core.network.MemoryForget
import com.dhama.mybase.core.network.avatarFileName
import com.dhama.mybase.core.network.avatarPhotoError
import com.dhama.mybase.core.network.RemoteAppearance
import com.dhama.mybase.core.network.RemoteAvatar
import com.dhama.mybase.core.network.RemoteAvatarSummary
import com.dhama.mybase.core.network.RemoteConversation
import com.dhama.mybase.core.network.RemoteLastMessage
import com.dhama.mybase.core.network.RemoteMemory
import com.dhama.mybase.core.network.RemoteMessage
import com.dhama.mybase.core.network.RemotePersonality
import com.dhama.mybase.core.network.RemoteSubscription
import com.dhama.mybase.core.network.RemoteUser
import com.dhama.mybase.core.network.ARCHIVE_NOTICE
import com.dhama.mybase.core.network.bringBackLabel
import com.dhama.mybase.core.network.conversationPreview
import com.dhama.mybase.core.network.conversationTitle
import com.dhama.mybase.core.network.decodeDataList
import com.dhama.mybase.core.network.relativeChatTime
import com.dhama.mybase.core.network.displayNameError
import com.dhama.mybase.core.network.epochMillis
import com.dhama.mybase.core.network.memoryForgetAction
import com.dhama.mybase.core.network.planCardStatus
import com.dhama.mybase.core.network.apiJson
import com.dhama.mybase.core.network.passwordChangeError
import com.dhama.mybase.core.network.parseUsageSummary
import com.dhama.mybase.core.network.planLabel
import com.dhama.mybase.core.network.serverLocalId
import com.dhama.mybase.core.network.serverRecordId
import com.dhama.mybase.core.network.toRestored
import com.dhama.mybase.core.network.toSaved
import com.dhama.mybase.core.network.unwrapData
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
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
        assertNull(saved.ethnicity)
        assertNull(saved.bodyType)
        assertNull(saved.height)
        assertNull(saved.clothingStyle)
        assertNull(saved.hairStyle)
        assertEquals(4, saved.serverId)
        assertEquals(9, saved.conversationId)
        assertEquals("FEMALE", saved.gender)
        assertEquals("Hi — I'm Aria.", saved.greeting)
    }

    @Test
    fun restoredLookFieldsStayOnTheCompanion() {
        val avatar = apiJson().decodeFromString<RemoteAvatar>(
            """{"id":4,"name":"Aria","appearance":{"ethnicity":" South Asian ","bodyType":"Athletic","height":"5 ft 6 in","clothingStyle":"Casual","hairStyle":"Wavy","hairColor":"Brown","eyeColor":"Blue","skinTone":"Warm"}}""",
        )
        val saved = avatar.toSaved(conversationId = 9, nowEpochMs = 1L)
        assertEquals("South Asian", saved.ethnicity)
        assertEquals("Athletic", saved.bodyType)
        assertEquals("5 ft 6 in", saved.height)
        assertEquals("Casual", saved.clothingStyle)
        assertEquals("Wavy", saved.hairStyle)
        assertEquals(
            "Realistic · Brown hair · Blue eyes · Warm skin · South Asian · Athletic build · 5 ft 6 in · Casual · Wavy hair",
            saved.lookLine(),
        )
        val blank = RemoteAvatar(
            id = 4,
            name = "Aria",
            appearance = RemoteAppearance(ethnicity = "  ", hairStyle = ""),
        ).toSaved(1, 1L)
        assertNull(blank.ethnicity)
        assertNull(blank.hairStyle)
    }

    @Test
    fun restoredGenderKeepsMale() {
        val saved = RemoteAvatar(id = 4, name = "Aria", gender = "MALE")
            .toSaved(conversationId = 1, nowEpochMs = 1L)
        assertEquals("MALE", saved.gender)
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
    fun passwordRulesMatchTheChangeEndpoint() {
        assertEquals("Enter your current password.", passwordChangeError("", "new-password"))
        assertEquals("Use at least 8 characters.", passwordChangeError("old-password", "short"))
        assertEquals("Choose a different password.", passwordChangeError("same-password", "same-password"))
        assertNull(passwordChangeError("old-password", "new-password"))
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

    @Test
    fun usageSummaryKeepsLimitsAndANullUnlimitedValue() {
        val usage = parseUsageSummary(
            """{"plan":"FREE","period":{"start":"2025-03-01T00:00:00Z","end":"2025-04-01T00:00:00Z"},"usage":[{"feature":"MESSAGES","used":12,"limit":100,"remaining":88},{"feature":"VOICE_MINUTES","used":1,"limit":10,"remaining":9},{"feature":"IMAGE_GENERATIONS","used":0,"limit":5,"remaining":5},{"feature":"TEXT_TOKENS","used":40,"limit":null,"remaining":null}]}""",
        )
        assertEquals(12, usage?.messagesUsed)
        assertEquals(100, usage?.messagesLimit)
        assertEquals(1, usage?.voiceUsed)
        assertEquals(10, usage?.voiceLimit)
        assertEquals(0, usage?.imagesUsed)
        assertEquals(5, usage?.imagesLimit)
        assertEquals(true, usage?.fromServer)
        assertEquals(epochMillis("2025-04-01T00:00:00Z"), usage?.resetEpochMs)
        assertEquals(null, parseUsageSummary(""))
    }

    @Test
    fun planLabelAndCurrentCard() {
        assertEquals("Free", planLabel("FREE"))
        assertEquals("Premium", planLabel("premium"))
        assertEquals("Premium Plus", planLabel("PREMIUM_PLUS"))
        assertEquals("Current plan", planCardStatus("Free", ""))
        assertEquals("Read only", planCardStatus("Premium", ""))
        assertEquals("Current plan", planCardStatus("Premium Plus", "Premium Plus"))
        val subscription = unwrapData<RemoteSubscription>(
            """{"data":{"id":1,"plan":"PREMIUM","status":"ACTIVE","userId":3}}""",
        )
        assertEquals("Premium", planLabel(subscription.plan))
    }

    @Test
    fun conversationTitleAndRelativeTime() {
        assertEquals("Aria", conversationTitle(null, "Aria"))
        assertEquals("Evening", conversationTitle(" Evening ", "Aria"))
        assertEquals("Just now", relativeChatTime(1_000L, 1_000L))
        assertEquals("5 min ago", relativeChatTime(1_000L, 1_000L + 5 * 60_000L))
        assertEquals("2 hr ago", relativeChatTime(1_000L, 1_000L + 2 * 60 * 60_000L))
        assertEquals("", relativeChatTime(0L, 5_000L))
        val day = 1_740_960_000_000L
        assertEquals("3 Mar", relativeChatTime(day, day + 10L * 24 * 60 * 60 * 1000))
    }

    @Test
    fun bringBackNamesHer() {
        assertEquals("Bring Aria back", bringBackLabel(" Aria "))
        assertEquals("Bring her back", bringBackLabel("  "))
        assertTrue(ARCHIVE_NOTICE.contains("bring her back"))
    }

    @Test
    fun conversationPreviewUsesTheLatestLine() {
        assertEquals("", conversationPreview(null))
        assertEquals(
            "Tell me about her.",
            conversationPreview(RemoteLastMessage(content = " Tell me about her. \n")),
        )
        assertEquals(
            "Voice note",
            conversationPreview(RemoteLastMessage(type = "AUDIO", content = " ")),
        )
        assertEquals("Photo", conversationPreview(RemoteLastMessage(type = "IMAGE")))
        assertEquals(
            "She said hi",
            conversationPreview(RemoteLastMessage(type = "AUDIO", content = "She said hi")),
        )
        val preview = conversationPreview(RemoteLastMessage(content = "a".repeat(90)))
        assertEquals(81, preview.length)
        assertEquals("…", preview.takeLast(1))
        val decoded = decodeDataList<RemoteConversation>(
            """{"data":[{"id":8,"userId":3,"companionId":4,"title":"Evening","lastMessageAt":"2026-09-30T07:00:00Z","createdAt":"2026-09-01T00:00:00Z","updatedAt":"2026-09-30T07:00:00Z","lastMessage":{"id":12,"role":"ASSISTANT","type":"TEXT","content":"I'm here.","audioUrl":null}}]}""",
        )
        assertEquals("I'm here.", decoded.single().lastMessage?.content)
        assertEquals("ASSISTANT", decoded.single().lastMessage?.role)
        assertEquals(
            null,
            decodeDataList<RemoteConversation>("""{"data":[{"id":3,"title":"First hello"}]}""")
                .single()
                .lastMessage,
        )
    }
}
