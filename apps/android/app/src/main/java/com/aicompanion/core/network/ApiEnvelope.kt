package com.aicompanion.core.network

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

@Serializable
data class ApiEnvelope<T>(
    val success: Boolean,
    val statusCode: Int,
    val message: JsonElement? = null,
    val data: T? = null,
    val timestamp: String? = null,
    val path: String? = null,
    val error: String? = null,
) {
    fun messageText(): String {
        val element = message ?: return error ?: "Something went wrong"
        return when (element) {
            is JsonPrimitive -> element.contentOrNull ?: "Something went wrong"
            is JsonArray -> element.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }
                .firstOrNull()
                ?: "Something went wrong"
            else -> "Something went wrong"
        }
    }
}
