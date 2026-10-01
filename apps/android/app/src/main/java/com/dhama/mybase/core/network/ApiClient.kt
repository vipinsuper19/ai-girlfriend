package com.dhama.mybase.core.network

import com.dhama.mybase.core.chat.ChatStreamEvent
import com.dhama.mybase.core.chat.consumeSse
import com.dhama.mybase.core.model.CreateAvatarRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.isActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.cancellation.CancellationException
import kotlin.coroutines.coroutineContext

class ApiClient(
    private val http: OkHttpClient,
    private val baseUrl: String,
    private val store: SessionStore,
    private val json: Json = apiJson(),
) {
    private val refreshMutex = Mutex()
    private val streamHttp = http.newBuilder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    fun origin(): String = apiOrigin(baseUrl)

    suspend fun establish(email: String, password: String) {
        val normalized = email.trim().lowercase()
        val tokens = attempt { login(normalized, password) }
            ?: attempt { register(normalized, password, sessionDisplayName(normalized)) }
        if (tokens != null) store.write(tokens) else store.clear()
    }

    suspend fun clear() {
        val access = store.read()?.accessToken
        if (access != null) {
            attempt {
                execute(
                    Request.Builder()
                        .url(url("auth/logout"))
                        .header("Authorization", "Bearer $access")
                        .post("{}".toRequestBody(JSON))
                        .build(),
                )
            }
        }
        store.clear()
    }

    suspend fun hasSession(): Boolean = store.read() != null

    suspend fun createAvatar(request: CreateAvatarRequest): Int {
        return withAuth { access ->
            unwrapData<IdPayload>(
                execute(jsonPost("avatars", request, access)),
                json,
            ).id
        }
    }

    suspend fun createConversation(companionId: Int, title: String): Int {
        return withAuth { access ->
            unwrapData<IdPayload>(
                execute(jsonPost("conversations", ConversationBody(companionId, title), access)),
                json,
            ).id
        }
    }

    suspend fun streamMessage(
        conversationId: Int,
        content: String,
        onEvent: suspend (ChatStreamEvent) -> Unit,
    ) {
        withContext(Dispatchers.IO) {
            withAuth { access ->
                val call = streamHttp.newCall(
                    jsonPost(
                        "conversations/$conversationId/messages/stream",
                        MessageBody(content),
                        access,
                    ),
                )
                try {
                    call.execute().use { response ->
                        val raw = if (response.isSuccessful) null else response.body?.string().orEmpty()
                        if (!response.isSuccessful) throw apiStatus(response.code, raw.orEmpty(), json)
                        val source = response.body?.source() ?: return@withAuth
                        val pending = StringBuilder()
                        while (true) {
                            coroutineContext.ensureActive()
                            val line = source.readUtf8Line() ?: break
                            pending.append(line).append('\n')
                            val (events, rest) = consumeSse(pending.toString())
                            pending.clear()
                            pending.append(rest)
                            events.forEach { onEvent(it) }
                        }
                    }
                } catch (error: IOException) {
                    if (!coroutineContext.isActive) throw CancellationException("Stopped", error)
                    throw error
                } finally {
                    call.cancel()
                }
            }
        }
    }

    suspend fun listAvatars(): List<RemoteAvatarSummary> {
        return withAuth { access -> decodeDataList(execute(authed("GET", "avatars", null, access))) }
    }

    suspend fun getAvatar(id: Int): RemoteAvatar {
        return withAuth { access -> unwrapData(execute(authed("GET", "avatars/$id", null, access))) }
    }

    suspend fun deleteConversation(id: Int) {
        withAuth { access -> execute(authed("DELETE", "conversations/$id", null, access)) }
    }

    suspend fun listConversations(): List<RemoteConversation> {
        return withAuth { access -> decodeDataList(execute(authed("GET", "conversations", null, access))) }
    }

    suspend fun listMessages(conversationId: Int): List<RemoteMessage> {
        return withAuth { access ->
            decodeDataList(execute(authed("GET", "conversations/$conversationId/messages", null, access)))
        }
    }

    suspend fun listMemories(companionId: Int): List<RemoteMemory> {
        return withAuth { access ->
            decodeDataList(execute(authed("GET", "memories?companionId=$companionId&limit=100", null, access)))
        }
    }

    suspend fun patchAvatar(id: Int, request: CreateAvatarRequest) {
        withAuth { access ->
            execute(authed("PATCH", "avatars/$id", json.encodeToString(request), access))
        }
    }

    suspend fun deleteAvatar(id: Int) {
        withAuth { access -> execute(authed("DELETE", "avatars/$id", null, access)) }
    }

    suspend fun uploadAvatar(id: Int, bytes: ByteArray, mime: String): String {
        return withAuth { access ->
            val body = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart(
                    "file",
                    avatarFileName(mime),
                    bytes.toRequestBody(mime.toMediaType()),
                )
                .build()
            val request = Request.Builder()
                .url(url("avatars/$id/avatar"))
                .header("Authorization", "Bearer $access")
                .post(body)
                .build()
            unwrapData<RemoteAvatarUpload>(execute(request), json).avatarUrl
        }
    }

    suspend fun deleteMessage(id: Int) {
        withAuth { access -> execute(authed("DELETE", "messages/$id", null, access)) }
    }

    suspend fun patchMemory(id: Int, content: String, type: String, importance: Int) {
        withAuth { access ->
            val payload = json.encodeToString(MemoryPatch(content, type, importance))
            execute(authed("PATCH", "memories/$id", payload, access))
        }
    }

    suspend fun deleteMemory(id: Int) {
        withAuth { access -> execute(authed("DELETE", "memories/$id", null, access)) }
    }

    suspend fun deleteAccount() {
        withAuth { access -> execute(authed("DELETE", "users/me", null, access)) }
    }

    suspend fun usageSummary(): RemoteUsageSummary {
        return withAuth { access ->
            unwrapData(execute(authed("GET", "usage/summary", null, access)))
        }
    }

    suspend fun currentSubscription(): RemoteSubscription {
        return withAuth { access ->
            unwrapData(execute(authed("GET", "subscriptions/current", null, access)))
        }
    }

    suspend fun getMe(): RemoteUser {
        return withAuth { access -> unwrapData(execute(authed("GET", "users/me", null, access))) }
    }

    suspend fun changePassword(currentPassword: String, newPassword: String) {
        withAuth { access ->
            execute(jsonPost("auth/password", PasswordBody(currentPassword, newPassword), access))
        }
    }

    suspend fun patchDisplayName(displayName: String): RemoteUser {
        return withAuth { access ->
            val payload = json.encodeToString(DisplayNameBody(displayName))
            unwrapData(execute(authed("PATCH", "users/me", payload, access)))
        }
    }

    suspend fun postMessage(conversationId: Int, content: String): PostedMessages {
        return withAuth { access ->
            val payload = json.encodeToString(MessageBody(content))
            unwrapData(
                execute(authed("POST", "conversations/$conversationId/messages", payload, access)),
                json,
            )
        }
    }

    suspend fun synthesize(companionId: Int, text: String): String {
        return withAuth { access ->
            val payload = json.encodeToString(SynthesizeBody(companionId, text))
            unwrapData<SynthesizedSpeech>(
                execute(authed("POST", "voice/synthesize", payload, access)),
                json,
            ).audioUrl
        }
    }

    suspend fun respondVoice(conversationId: Int, audioFile: File): VoiceTurn {
        return withAuth { access ->
            val body = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("conversationId", conversationId.toString())
                .addFormDataPart(
                    "audio",
                    audioFile.name,
                    audioFile.asRequestBody("audio/mp4".toMediaType()),
                )
                .build()
            val request = Request.Builder()
                .url(url("voice/respond"))
                .header("Authorization", "Bearer $access")
                .post(body)
                .build()
            unwrapData(execute(request), json)
        }
    }

    private suspend fun login(email: String, password: String): SessionTokens {
        return unwrapData(execute(jsonPost("auth/login", LoginBody(email, password))), json)
    }

    private suspend fun register(email: String, password: String, displayName: String): SessionTokens {
        return unwrapData(
            execute(jsonPost("auth/register", RegisterBody(email, password, displayName))),
            json,
        )
    }

    private suspend fun <T> withAuth(block: suspend (String) -> T): T {
        val existing = store.read()?.accessToken
            ?: throw ApiStatusException(401, "Sign in with email to reach her on the server.", null)
        try {
            return block(existing)
        } catch (error: ApiStatusException) {
            if (error.status != 401) throw error
            val next = refresh(existing) ?: throw error
            return block(next)
        }
    }

    private suspend fun refresh(failedAccess: String): String? {
        return refreshMutex.withLock {
            val current = store.read()
            if (current != null && current.accessToken != failedAccess) {
                return@withLock current.accessToken
            }
            val refreshToken = current?.refreshToken ?: return@withLock null
            val renewed = attempt {
                unwrapData<SessionTokens>(
                    execute(jsonPost("auth/refresh", RefreshBody(refreshToken))),
                    json,
                )
            }
            if (renewed == null) {
                store.clear()
                null
            } else {
                store.write(renewed)
                renewed.accessToken
            }
        }
    }

    private fun jsonPost(path: String, body: Any, access: String? = null): Request {
        val payload = when (body) {
            is LoginBody -> json.encodeToString(body)
            is RegisterBody -> json.encodeToString(body)
            is RefreshBody -> json.encodeToString(body)
            is PasswordBody -> json.encodeToString(body)
            is CreateAvatarRequest -> json.encodeToString(body)
            is ConversationBody -> json.encodeToString(body)
            is MessageBody -> json.encodeToString(body)
            else -> error("Unsupported body")
        }
        return authed("POST", path, payload, access)
    }

    private fun authed(method: String, path: String, payload: String?, access: String?): Request {
        val builder = Request.Builder().url(url(path))
        if (access != null) builder.header("Authorization", "Bearer $access")
        val body = if (method == "GET" || method == "DELETE") {
            null
        } else {
            payload.orEmpty().toRequestBody(JSON)
        }
        return builder.method(method, body).build()
    }

    private suspend fun execute(request: Request): String = withContext(Dispatchers.IO) {
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw apiStatus(response.code, raw, json)
            raw
        }
    }

    private fun url(path: String): String {
        return baseUrl.trimEnd('/') + "/" + path.trimStart('/')
    }

    private companion object {
        val JSON = "application/json".toMediaType()
    }
}

private suspend fun <T> attempt(block: suspend () -> T): T? {
    return try {
        block()
    } catch (error: CancellationException) {
        throw error
    } catch (_: Exception) {
        null
    }
}

@Serializable
private data class LoginBody(val email: String, val password: String)

@Serializable
private data class RegisterBody(val email: String, val password: String, val displayName: String)

@Serializable
private data class RefreshBody(val refreshToken: String)

@Serializable
private data class PasswordBody(val currentPassword: String, val newPassword: String)

@Serializable
private data class ConversationBody(val companionId: Int, val title: String)

@Serializable
private data class MessageBody(val content: String)

@Serializable
private data class IdPayload(val id: Int)

@Serializable
private data class MemoryPatch(val content: String, val type: String, val importance: Int)

@Serializable
private data class DisplayNameBody(val displayName: String)

@Serializable
private data class SynthesizeBody(val companionId: Int, val text: String)

@Serializable
private data class SynthesizedSpeech(val audioUrl: String = "")

@Serializable
data class VoiceTurn(
    val transcript: String = "",
    val assistantMessage: VoiceMessageBody? = null,
    val audio: VoiceAudioBody? = null,
)

@Serializable
data class VoiceMessageBody(val content: String? = null)

@Serializable
data class VoiceAudioBody(val audioUrl: String = "")
