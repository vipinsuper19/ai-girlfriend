package com.dhama.mybase.core.data

import com.dhama.mybase.core.db.dao.MemoryDao
import com.dhama.mybase.core.db.entity.MemoryEntity
import com.dhama.mybase.core.domain.MemoryRepository
import com.dhama.mybase.core.memory.noticeFromMessage
import kotlinx.coroutines.flow.Flow
import java.util.UUID

class MemoryRepositoryImpl(
    private val dao: MemoryDao,
) : MemoryRepository {

    override fun observe(): Flow<List<MemoryEntity>> = dao.observe()

    override suspend fun notice(userText: String) {
        val noticed = noticeFromMessage(userText) ?: return
        if (dao.countByContent(noticed.content) > 0) return
        val now = System.currentTimeMillis()
        dao.upsert(
            MemoryEntity(
                id = UUID.randomUUID().toString(),
                type = noticed.type,
                content = noticed.content,
                importance = noticed.importance.coerceIn(0, 100),
                confidence = noticed.confidence.coerceIn(0f, 1f),
                source = SOURCE_USER_MESSAGE,
                createdAtEpochMs = now,
                updatedAtEpochMs = now,
            ),
        )
    }

    override suspend fun update(id: String, content: String, type: String, importance: Int) {
        val current = dao.find(id) ?: return
        val body = content.trim()
        if (body.isEmpty()) return
        dao.upsert(
            current.copy(
                content = body,
                type = type,
                importance = importance.coerceIn(0, 100),
                updatedAtEpochMs = System.currentTimeMillis(),
            ),
        )
    }

    override suspend fun delete(id: String) {
        dao.delete(id)
    }

    override suspend fun clear() {
        dao.clear()
    }

    companion object {
        const val SOURCE_USER_MESSAGE = "USER_MESSAGE"
    }
}
