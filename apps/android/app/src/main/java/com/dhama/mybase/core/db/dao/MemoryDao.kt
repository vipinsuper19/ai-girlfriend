package com.dhama.mybase.core.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.dhama.mybase.core.db.entity.MemoryEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface MemoryDao {
    @Query("SELECT * FROM memories ORDER BY importance DESC, createdAtEpochMs DESC")
    fun observe(): Flow<List<MemoryEntity>>

    @Query("SELECT * FROM memories")
    suspend fun snapshot(): List<MemoryEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(memory: MemoryEntity)

    @Query("SELECT * FROM memories WHERE id = :id LIMIT 1")
    suspend fun find(id: String): MemoryEntity?

    @Query("SELECT COUNT(*) FROM memories WHERE content = :content")
    suspend fun countByContent(content: String): Int

    @Query("DELETE FROM memories WHERE id = :id")
    suspend fun delete(id: String)

    @Query("DELETE FROM memories")
    suspend fun clear()
}
