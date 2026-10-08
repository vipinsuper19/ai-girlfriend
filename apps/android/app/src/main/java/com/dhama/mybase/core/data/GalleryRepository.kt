package com.dhama.mybase.core.data

import com.dhama.mybase.core.domain.CompanionRepository
import com.dhama.mybase.core.network.ApiClient
import com.dhama.mybase.core.network.ApiStatusException
import com.dhama.mybase.core.network.epochMillis
import com.dhama.mybase.core.network.galleryUrl
import kotlinx.coroutines.flow.first
import javax.inject.Inject

data class GalleryImage(
    val id: Int,
    val url: String,
    val prompt: String,
    val createdAtEpochMs: Long,
)

class GalleryRepository @Inject constructor(
    private val api: ApiClient,
    private val companions: CompanionRepository,
) {
    private suspend fun companionId(): Int {
        val serverId = companions.observe().first()?.serverId
        if (serverId == null || !api.hasSession()) {
            throw ApiStatusException(401, "Sign in with email to make photos of her.", null)
        }
        return serverId
    }

    suspend fun list(): List<GalleryImage> {
        return api.listImages(companionId()).mapNotNull { it.toGallery(api.origin()) }
    }

    suspend fun create(prompt: String): GalleryImage {
        val created = api.createImage(companionId(), prompt)
        return created.toGallery(api.origin())
            ?: throw ApiStatusException(0, "Couldn't make that photo.", null)
    }

    suspend fun delete(id: Int) {
        api.deleteImage(id)
    }

    private fun com.dhama.mybase.core.network.RemoteImage.toGallery(origin: String): GalleryImage? {
        val url = galleryUrl(origin) ?: return null
        return GalleryImage(id, url, prompt, epochMillis(createdAt))
    }
}
