package com.dhama.mybase.core.network

import com.dhama.mybase.core.age.AGE_PATCH_PATH
import com.dhama.mybase.core.age.SEND_AGE_TO_API
import com.dhama.mybase.core.age.googleAuthRequestJson
import com.dhama.mybase.core.age.registerRequestJson
import com.dhama.mybase.core.age.agePatchJson
import com.dhama.mybase.core.chat.ChatStreamEvent
import com.dhama.mybase.core.data.ACCOUNT_DELETE_SIGN_IN
import com.dhama.mybase.core.data.ACCOUNT_DELETE_SIGN_IN_CODE
import com.dhama.mybase.core.chat.consumeSse
import com.dhama.mybase.core.chat.messageListQuery
import com.dhama.mybase.core.model.CreateAvatarRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import okhttp3.Call
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.io.IOException
import java.io.InterruptedIOException
import java.net.SocketTimeoutException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.cancellation.CancellationException
import kotlin.coroutines.coroutineContext

class ApiClient(
    private val http: OkHttpClient,
    private val baseUrl: String,
    private val store: SessionStore,
    private val json: Json = apiJson(),
    private val streamIdleMillis: Long = STREAM_IDLE_TIMEOUT_MS,
    private val firstReadMillis: Long = FIRST_READ_TIMEOUT_MS,
) {
    private val refreshMutex = Mutex()
    private val streamHttp = streamOkHttp(http, firstReadMillis)
    private val imageHttp = http.newBuilder()
        .readTimeout(90, TimeUnit.SECONDS)
        .build()
    private val prettyJson = Json(json) { prettyPrint = true }

    fun origin(): String = apiOrigin(baseUrl)

    suspend fun establish(
        email: String,
        password: String,
        dateOfBirth: String? = null,
        ageConfirmedAt: String? = null,
    ) {
        val normalized = email.trim().lowercase()
        val tokens = attempt { login(normalized, password) }
            ?: attempt { register(normalized, password, sessionDisplayName(normalized), dateOfBirth, ageConfirmedAt) }
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
                    // The body read blocks a thread, so Stop cancels the Call from the
                    // cancellation handler. That closes the socket and the server sees it.
                    coroutineScope {
                        val scope = this
                        suspendCancellableCoroutine { continuation ->
                            continuation.invokeOnCancellation { call.cancel() }
                            val reader = scope.launch {
                                readStream(call, onEvent)
                            }
                            reader.invokeOnCompletion { error ->
                                if (error == null && continuation.isActive) continuation.resume(Unit)
                            }
                        }
                    }
                } finally {
                    call.cancel()
                }
            }
        }
    }

    private suspend fun readStream(
        call: Call,
        onEvent: suspend (ChatStreamEvent) -> Unit,
    ) {
        try {
            call.execute().use { response ->
                val raw = if (response.isSuccessful) null else response.body?.string().orEmpty()
                if (!response.isSuccessful) throw apiStatus(response.code, raw.orEmpty(), json)
                val source = response.body?.source() ?: return
                val timeout = source.timeout()
                timeout.clearDeadline()
                timeout.timeout(streamIdleMillis, TimeUnit.MILLISECONDS)
                val pending = StringBuilder()
                while (true) {
                    coroutineContext.ensureActive()
                    val line = try {
                        source.readUtf8Line()
                    } catch (error: IOException) {
                        throw error.streamFailure(coroutineContext.isActive)
                    } ?: break
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
        }
    }

    suspend fun listAvatars(): List<RemoteAvatarSummary> {
        return withAuth { access -> decodeDataList(execute(authed("GET", "avatars", null, access))) }
    }

    suspend fun listArchivedAvatars(): List<RemoteAvatarSummary> {
        return withAuth { access ->
            decodeDataList(execute(authed("GET", "avatars?status=ARCHIVED", null, access)))
        }
    }

    suspend fun restoreAvatar(id: Int): RemoteAvatar {
        return withAuth { access ->
            unwrapData(execute(authed("POST", "avatars/$id/restore", null, access)))
        }
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

    suspend fun listMessages(
        conversationId: Int,
        before: Int? = null,
        limit: Int? = null,
    ): List<RemoteMessage> {
        val query = messageListQuery(before, limit)
        return withAuth { access ->
            decodeDataList(
                execute(authed("GET", "conversations/$conversationId/messages$query", null, access)),
            )
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

    suspend fun clearMemories(companionId: Int?) {
        val query = if (companionId != null) "?companionId=$companionId" else ""
        withAuth { access -> execute(authed("DELETE", "memories$query", null, access)) }
    }

    /**
     * DELETE /users/me.
     * A 404 from this call counts as success in [com.dhama.mybase.core.data.deleteServerAccount].
     * A 401 after the refresh token is rejected keeps the session store intact and is reported
     * as [ACCOUNT_DELETE_SIGN_IN_CODE] so the app can sign Firebase out before clearing it.
     */
    suspend fun deleteAccount() {
        withAuth(keepSessionOnRefreshFailure = true) { access ->
            execute(authed("DELETE", "users/me", null, access))
        }
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

    /** Trades a Firebase Google ID token for an API session. Returns false when the API refuses it. */
    suspend fun establishWithGoogle(
        idToken: String,
        dateOfBirth: String? = null,
        ageConfirmedAt: String? = null,
    ): Boolean {
        val payload = googleAuthRequestJson(idToken, dateOfBirth, ageConfirmedAt, SEND_AGE_TO_API, json)
        val tokens = attempt { unwrapData<SessionTokens>(execute(authed("POST", "auth/google", payload, null)), json) }
        if (tokens != null) store.write(tokens) else store.clear()
        return tokens != null
    }

    /**
     * PATCH users/me/age. No request is made while [SEND_AGE_TO_API] is false,
     * so the date of birth cannot be logged from a body that was never sent.
     */
    suspend fun patchAge(dateOfBirth: String, ageConfirmedAt: String) {
        if (!SEND_AGE_TO_API) return
        val payload = agePatchJson(dateOfBirth, ageConfirmedAt, json)
        withAuth { access ->
            execute(authed("PATCH", AGE_PATCH_PATH, payload, access))
        }
    }

    suspend fun regenerate(messageId: Int): RegeneratedReply {
        return withAuth { access ->
            unwrapData(execute(authed("POST", "messages/$messageId/regenerate", "{}", access)), json)
        }
    }

    suspend fun createMemory(companionId: Int, content: String, type: String): RemoteMemory {
        return withAuth { access ->
            val payload = json.encodeToString(NewMemoryBody(companionId, content, type))
            unwrapData(execute(authed("POST", "memories", payload, access)), json)
        }
    }

    suspend fun patchPrivacy(memoryPaused: Boolean? = null, notificationsEnabled: Boolean? = null): RemoteUser {
        return withAuth { access ->
            val payload = json.encodeToString(PrivacyBody(memoryPaused, notificationsEnabled))
            unwrapData(execute(authed("PATCH", "users/me", payload, access)), json)
        }
    }

    /** The export as indented JSON, ready to save. */
    suspend fun exportMe(): String {
        return withAuth { access ->
            val data = dataElement(execute(authed("GET", "users/me/export", null, access)), json)
            prettyJson.encodeToString(JsonElement.serializer(), data)
        }
    }

    suspend fun listImages(companionId: Int): List<RemoteImage> {
        return withAuth { access ->
            decodeDataList(execute(authed("GET", "images?companionId=$companionId", null, access)), json)
        }
    }

    suspend fun createImage(companionId: Int, prompt: String): RemoteImage {
        return withAuth { access ->
            val payload = json.encodeToString(NewImageBody(companionId, prompt.trim().ifBlank { null }))
            unwrapData(execute(imageHttp, authed("POST", "images", payload, access)), json)
        }
    }

    suspend fun deleteImage(id: Int) {
        withAuth { access -> execute(authed("DELETE", "images/$id", null, access)) }
    }

    suspend fun notificationStatus(): RemoteNotificationStatus {
        return withAuth { access -> unwrapData(execute(authed("GET", "notifications/status", null, access)), json) }
    }

    suspend fun registerDevice(token: String) {
        withAuth { access ->
            val payload = json.encodeToString(DeviceBody(token, "ANDROID"))
            execute(authed("POST", "notifications/devices", payload, access))
        }
    }

    suspend fun removeDevice(token: String) {
        withAuth { access ->
            execute(authed("DELETE", "notifications/devices/${encodePath(token)}", null, access))
        }
    }

    suspend fun googlePlayConfig(): RemotePlayConfig {
        return withAuth { access -> unwrapData(execute(authed("GET", "subscriptions/google-play", null, access)), json) }
    }

    suspend fun verifyGooglePlay(productId: String, purchaseToken: String): RemoteSubscription {
        return withAuth { access ->
            val payload = json.encodeToString(PlayPurchaseBody(productId, purchaseToken))
            unwrapData(execute(authed("POST", "subscriptions/google-play", payload, access)), json)
        }
    }

    private suspend fun login(email: String, password: String): SessionTokens {
        return unwrapData(execute(jsonPost("auth/login", LoginBody(email, password))), json)
    }

    private suspend fun register(
        email: String,
        password: String,
        displayName: String,
        dateOfBirth: String?,
        ageConfirmedAt: String?,
    ): SessionTokens {
        val payload = registerRequestJson(
            email,
            password,
            displayName,
            dateOfBirth,
            ageConfirmedAt,
            SEND_AGE_TO_API,
            json,
        )
        return unwrapData(execute(authed("POST", "auth/register", payload, null)), json)
    }

    private suspend fun <T> withAuth(
        keepSessionOnRefreshFailure: Boolean = false,
        block: suspend (String) -> T,
    ): T {
        val existing = store.read()?.accessToken
            ?: throw ApiStatusException(401, "Sign in with email to reach her on the server.", null)
        try {
            return block(existing)
        } catch (error: ApiStatusException) {
            if (error.status != 401) throw error
            val next = refresh(existing, clearOnFailure = !keepSessionOnRefreshFailure)
            if (next == null && keepSessionOnRefreshFailure) {
                throw ApiStatusException(401, ACCOUNT_DELETE_SIGN_IN, ACCOUNT_DELETE_SIGN_IN_CODE)
            }
            return block(next ?: throw error)
        }
    }

    private suspend fun refresh(failedAccess: String, clearOnFailure: Boolean = true): String? {
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
                // Account deletion leaves the store until Firebase is signed out.
                if (clearOnFailure) store.clear()
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

    private suspend fun execute(request: Request): String = execute(http, request)

    private suspend fun execute(client: OkHttpClient, request: Request): String = withContext(Dispatchers.IO) {
        client.newCall(request).execute().use { response ->
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

private fun IOException.streamFailure(active: Boolean): Throwable {
    if (!active) return CancellationException("Stopped", this)
    if (isReadStall()) return StreamIdleException()
    return this
}

private fun IOException.isReadStall(): Boolean {
    if (this is SocketTimeoutException) return true
    return this is InterruptedIOException && message?.contains("timeout", ignoreCase = true) == true
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
private data class NewMemoryBody(val companionId: Int, val content: String, val type: String)

@Serializable
private data class PrivacyBody(val memoryPaused: Boolean? = null, val notificationsEnabled: Boolean? = null)

@Serializable
private data class NewImageBody(val companionId: Int, val prompt: String? = null)

@Serializable
private data class DeviceBody(val token: String, val platform: String)

@Serializable
private data class PlayPurchaseBody(val productId: String, val purchaseToken: String)

private fun encodePath(segment: String): String =
    java.net.URLEncoder.encode(segment, "UTF-8").replace("+", "%20")

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
