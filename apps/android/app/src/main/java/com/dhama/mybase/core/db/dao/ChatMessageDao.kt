package com.dhama.mybase.core.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.dhama.mybase.core.db.entity.ChatMessageEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ChatMessageDao {
    @Query("SELECT * FROM chat_messages ORDER BY createdAtEpochMs ASC")
    fun observe(): Flow<List<ChatMessageEntity>>

    @Query("SELECT * FROM chat_messages")
    suspend fun snapshot(): List<ChatMessageEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(message: ChatMessageEntity)

    @Query("SELECT * FROM chat_messages WHERE id = :id LIMIT 1")
    suspend fun find(id: String): ChatMessageEntity?

    @Query("DELETE FROM chat_messages WHERE id = :id")
    suspend fun delete(id: String)

    @Query("DELETE FROM chat_messages")
    suspend fun clear()

    @Query("SELECT COUNT(*) FROM chat_messages")
    suspend fun count(): Int
}
