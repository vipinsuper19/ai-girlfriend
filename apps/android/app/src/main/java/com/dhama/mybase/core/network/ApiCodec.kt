package com.dhama.mybase.core.network

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.decodeFromJsonElement

class ApiStatusException(
    val status: Int,
    message: String,
    val code: String?,
) : Exception(crashSafeExceptionMessage(message))

@Serializable
data class SessionTokens(
    val accessToken: String,
    val refreshToken: String,
)

fun apiJson(): Json = Json {
    ignoreUnknownKeys = true
    encodeDefaults = false
    explicitNulls = false
}

fun apiOrigin(baseUrl: String): String {
    return baseUrl.trim().trimEnd('/').removeSuffix("/api/v1")
}

fun sessionDisplayName(email: String): String {
    val local = email.substringBefore('@').filter { it.isLetterOrDigit() }
    return if (local.length >= 2) local.take(100) else "Friend"
}

fun apiStatus(status: Int, body: String, json: Json = apiJson()): ApiStatusException {
    val parsed = runCatching { json.parseToJsonElement(body) as? JsonObject }.getOrNull()
    val code = (parsed?.get("code") as? JsonPrimitive)?.content
    val message = messageText(parsed?.get("message")) ?: "Request failed"
    val safe = if (echoesUserPayload(message, echoedPayloadValues(parsed))) "Request failed" else message
    return ApiStatusException(status, safe, code)
}

inline fun <reified T> unwrapData(body: String, json: Json = apiJson()): T {
    try {
        return json.decodeFromJsonElement(dataElement(body, json))
    } catch (error: ApiStatusException) {
        throw error
    } catch (error: Exception) {
        throw scrubTransportFailure(error)
    }
}

inline fun <reified T> decodeDataList(body: String, json: Json = apiJson()): List<T> {
    try {
        val data = dataElement(body, json)
        if (data is JsonArray && data.isEmpty()) return emptyList()
        return json.decodeFromJsonElement(data)
    } catch (error: ApiStatusException) {
        throw error
    } catch (error: Exception) {
        throw scrubTransportFailure(error)
    }
}

fun dataElement(body: String, json: Json = apiJson()): JsonElement {
    val root = try {
        json.parseToJsonElement(body) as? JsonObject
    } catch (error: Exception) {
        throw scrubTransportFailure(error)
    } ?: throw ApiStatusException(0, "The server sent an unexpected response.", null)
    return root["data"]
        ?: throw ApiStatusException(0, "The server sent an unexpected response.", null)
}

private val echoedPayloadKeys = setOf(
    "content",
    "prompt",
    "system_prompt",
    "systemPrompt",
    "text",
    "body",
)

private fun echoedPayloadValues(root: JsonObject?): List<String> {
    if (root == null) return emptyList()
    return echoedPayloadKeys.mapNotNull { key ->
        (root[key] as? JsonPrimitive)?.takeIf { it.isString }?.content
    }
}

private fun messageText(element: JsonElement?): String? {
    return when (element) {
        is JsonArray -> element.mapNotNull { (it as? JsonPrimitive)?.content }
            .joinToString(", ")
            .ifBlank { null }
        is JsonPrimitive -> element.content.ifBlank { null }
        else -> null
    }
}
