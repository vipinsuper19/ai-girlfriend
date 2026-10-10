package com.dhama.mybase.core.data

import com.dhama.mybase.core.db.dao.MemoryDao
import com.dhama.mybase.core.db.entity.MemoryEntity
import com.dhama.mybase.core.domain.CompanionRepository
import com.dhama.mybase.core.domain.MemoryClearResult
import com.dhama.mybase.core.domain.MemoryRepository
import com.dhama.mybase.core.memory.MEMORY_CONTENT_MAX
import com.dhama.mybase.core.memory.noticeFromMessage
import com.dhama.mybase.core.network.ApiClient
import com.dhama.mybase.core.network.phoneImportance
import com.dhama.mybase.core.network.serverImportance
import com.dhama.mybase.core.network.toRestored
import com.dhama.mybase.core.utils.PreferencesKeys
import com.dhama.mybase.core.network.memoriesToForget
import com.dhama.mybase.core.network.serverRecordId
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.Flow
import java.util.UUID
import kotlin.coroutines.cancellation.CancellationException

class MemoryRepositoryImpl(
    private val dao: MemoryDao,
    private val api: ApiClient,
    private val companions: CompanionRepository,
    private val dataStore: DataStoreRepo,
) : MemoryRepository {

    override fun observe(): Flow<List<MemoryEntity>> = dao.observe()

    override fun observePaused(): Flow<Boolean> =
        dataStore.getBoolean(PreferencesKeys.MEMORY_PAUSED, false)

    override suspend fun setPaused(paused: Boolean) {
        val saved = if (api.hasSession()) api.patchPrivacy(memoryPaused = paused).memoryPaused else paused
        dataStore.saveBoolean(PreferencesKeys.MEMORY_PAUSED, saved)
    }

    override suspend fun add(content: String, type: String) {
        val body = content.trim().take(MEMORY_CONTENT_MAX)
        if (body.isEmpty()) return
        val companionId = companions.observe().first()?.serverId
        val now = System.currentTimeMillis()
        if (companionId != null && api.hasSession()) {
            val created = api.createMemory(companionId, body, type).toRestored(now)
            dao.upsert(
                MemoryEntity(
                    id = created.id,
                    type = created.type,
                    content = created.content,
                    importance = created.importance,
                    confidence = created.confidence,
                    source = created.source,
                    createdAtEpochMs = created.createdAtEpochMs,
                    updatedAtEpochMs = created.updatedAtEpochMs,
                ),
            )
            return
        }
        dao.upsert(
            MemoryEntity(
                id = UUID.randomUUID().toString(),
                type = type,
                content = body,
                importance = phoneImportance(USER_MEMORY_IMPORTANCE),
                confidence = 1f,
                source = SOURCE_USER_INPUT,
                createdAtEpochMs = now,
                updatedAtEpochMs = now,
            ),
        )
    }

    override suspend fun notice(userText: String) {
        if (observePaused().first()) return
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
            api.patchMemory(serverId, body, type, serverImportance(importanceValue))
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

    override suspend fun clearAll(onProgress: suspend (done: Int, total: Int) -> Unit): MemoryClearResult {
        val rows = dao.snapshot()
        val total = rows.size
        if (total == 0) {
            onProgress(0, 0)
            return MemoryClearResult(0, 0)
        }
        onProgress(0, total)
        val session = api.hasSession()
        val hasServer = rows.any { serverRecordId(it.id) != null }
        var serverCleared = false
        if (session && hasServer) {
            val companionId = companions.observe().first()?.serverId
            serverCleared = try {
                api.clearMemories(companionId)
                true
            } catch (error: CancellationException) {
                throw error
            } catch (_: Exception) {
                false
            }
        }
        val drop = memoriesToForget(rows.map { it.id }, session, serverCleared)
        drop.forEach { dao.delete(it) }
        onProgress(drop.size, total)
        return MemoryClearResult(drop.size, total - drop.size)
    }

    companion object {
        const val SOURCE_USER_MESSAGE = "USER_MESSAGE"
        const val SOURCE_USER_INPUT = "USER_INPUT"
        private const val USER_MEMORY_IMPORTANCE = 7
    }
}
