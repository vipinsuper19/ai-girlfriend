package com.dhama.mybase.ui.preview

import com.dhama.mybase.core.db.entity.ChatMessageEntity
import com.dhama.mybase.core.db.entity.MemoryEntity
import com.dhama.mybase.core.model.SavedCompanion
import com.dhama.mybase.core.network.RemoteConversation
import com.dhama.mybase.core.network.RemoteLastMessage

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
    ethnicity = "South Asian",
    bodyType = "Athletic",
    height = "5 ft 6 in",
    clothingStyle = "Casual",
    hairStyle = "Wavy",
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
    RemoteConversation(
        id = 8,
        companionId = 4,
        title = "Evening",
        lastMessageAt = "2026-09-30T07:00:00Z",
        lastMessage = RemoteLastMessage(
            id = 12,
            role = "ASSISTANT",
            content = "Tell me about her. I'm right here.",
        ),
    ),
    RemoteConversation(
        id = 3,
        companionId = 4,
        title = "First hello",
        lastMessageAt = "2026-09-12T18:00:00Z",
        lastMessage = RemoteLastMessage(id = 4, role = "USER", type = "AUDIO"),
    ),
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
    ChatMessageEntity(
        id = "user-2",
        role = "USER",
        text = "Are you still there?",
        createdAtEpochMs = 1_735_689_720_000L,
        delivery = "SENT",
    ),
    ChatMessageEntity(
        id = "assistant-2",
        role = "ASSISTANT",
        text = "I am —",
        createdAtEpochMs = 1_735_689_721_000L,
        delivery = "DROPPED",
    ),
)
