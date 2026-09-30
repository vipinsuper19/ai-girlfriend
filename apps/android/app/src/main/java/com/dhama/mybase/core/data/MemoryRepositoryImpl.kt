package com.dhama.mybase.core.data

import com.dhama.mybase.core.db.dao.MemoryDao
import com.dhama.mybase.core.db.entity.MemoryEntity
import com.dhama.mybase.core.domain.MemoryRepository
import com.dhama.mybase.core.memory.noticeFromMessage
import com.dhama.mybase.core.network.ApiClient
import com.dhama.mybase.core.network.serverRecordId
import kotlinx.coroutines.flow.Flow
import java.util.UUID

class MemoryRepositoryImpl(
    private val dao: MemoryDao,
    private val api: ApiClient,
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
        val importanceValue = importance.coerceIn(0, 100)
        val serverId = serverRecordId(id)
        if (serverId != null && api.hasSession()) {
            api.patchMemory(serverId, body, type, importanceValue)
        }
        dao.upsert(
            current.copy(
                content = body,
                type = type,
                importance = importanceValue,
                updatedAtEpochMs = System.currentTimeMillis(),
            ),
        )
    }

    override suspend fun delete(id: String) {
        val serverId = serverRecordId(id)
        if (serverId != null && api.hasSession()) {
            api.deleteMemory(serverId)
        }
        dao.delete(id)
    }

    override suspend fun clear() {
        dao.clear()
    }

    companion object {
        const val SOURCE_USER_MESSAGE = "USER_MESSAGE"
    }
}
