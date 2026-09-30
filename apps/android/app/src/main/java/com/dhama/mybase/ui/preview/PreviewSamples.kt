package com.dhama.mybase.ui.preview

import com.dhama.mybase.core.db.entity.ChatMessageEntity
import com.dhama.mybase.core.db.entity.MemoryEntity
import com.dhama.mybase.core.model.SavedCompanion
import com.dhama.mybase.core.network.RemoteConversation

internal fun sampleCompanion(): SavedCompanion = SavedCompanion(
    name = "Aria",
    traits = listOf("Caring", "Playful", "Curious"),
    voiceLabel = "Warm",
    relationship = "Girlfriend",
    greeting = "Hi — I'm Aria. I don't know anything about you yet, and I'd like to.",
    style = "Realistic",
    systemPrompt = "",
    createdAtEpochMs = 1_735_689_600_000L,
    hairColor = "Brown",
    eyeColor = "Blue",
    skinTone = "Warm",
    serverId = 4,
    conversationId = 8,
    gender = "FEMALE",
)

internal fun sampleMemories(): List<MemoryEntity> = listOf(
    MemoryEntity(
        id = "server-1",
        type = "RELATIONSHIP",
        content = "You mentioned your sister",
        importance = 88,
        confidence = 0.74f,
        source = "CONVERSATION",
        createdAtEpochMs = 1_735_689_600_000L,
        updatedAtEpochMs = 1_735_689_600_000L,
    ),
    MemoryEntity(
        id = "server-2",
        type = "PREFERENCE",
        content = "You like late coffee",
        importance = 72,
        confidence = 0.8f,
        source = "CONVERSATION",
        createdAtEpochMs = 1_735_603_200_000L,
        updatedAtEpochMs = 1_735_603_200_000L,
    ),
)

internal fun sampleConversations(): List<RemoteConversation> = listOf(
    RemoteConversation(id = 8, companionId = 4, title = "Evening", lastMessageAt = "2026-09-30T07:00:00Z"),
    RemoteConversation(id = 3, companionId = 4, title = "First hello", lastMessageAt = "2026-09-12T18:00:00Z"),
)

internal fun sampleMessages(): List<ChatMessageEntity> = listOf(
    ChatMessageEntity(
        id = "greeting",
        role = "ASSISTANT",
        text = "Hi — I'm Aria. I don't know anything about you yet, and I'd like to.",
        createdAtEpochMs = 1_735_689_600_000L,
        delivery = "SENT",
    ),
    ChatMessageEntity(
        id = "user-1",
        role = "USER",
        text = "My sister called today.",
        createdAtEpochMs = 1_735_689_660_000L,
        delivery = "SENT",
    ),
    ChatMessageEntity(
        id = "assistant-1",
        role = "ASSISTANT",
        text = "Tell me about her. I'm right here.",
        createdAtEpochMs = 1_735_689_661_000L,
        delivery = "SENT",
    ),
)
