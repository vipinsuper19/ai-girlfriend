package com.dhama.mybase.core.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "memories")
data class MemoryEntity(
    @PrimaryKey val id: String,
    val type: String,
    val content: String,
    val importance: Int,
    val confidence: Float,
    val source: String,
    val createdAtEpochMs: Long,
    val updatedAtEpochMs: Long,
)
