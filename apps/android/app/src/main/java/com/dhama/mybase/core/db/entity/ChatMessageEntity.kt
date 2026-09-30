package com.dhama.mybase.core.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "chat_messages")
data class ChatMessageEntity(
    @PrimaryKey val id: String,
    val role: String,
    val text: String,
    val createdAtEpochMs: Long,
    val delivery: String,
    val kind: String = KIND_TEXT,
    val audioPath: String = "",
    val durationMs: Long = 0,
) {
    companion object {
        const val KIND_TEXT = "TEXT"
        const val KIND_AUDIO = "AUDIO"
        const val KIND_IMAGE = "IMAGE"
        const val KIND_SYSTEM = "SYSTEM"
    }
}
