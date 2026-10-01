package com.aicompanion.core.data

import com.aicompanion.core.common.AppError
import com.aicompanion.core.common.AppResult
import com.aicompanion.core.network.ApiEnvelope
import com.aicompanion.core.network.ApiErrorBody
import com.aicompanion.core.network.CompanionApi
import com.aicompanion.core.network.dto.AuthSessionDto
import com.aicompanion.core.network.dto.GoogleAuthRequest
import com.aicompanion.core.network.dto.LoginRequest
import com.aicompanion.core.network.dto.RegisterRequest
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.serialization.json.Json
import retrofit2.HttpException

@Singleton
class AuthRepository @Inject constructor(
    private val api: CompanionApi,
    private val tokenStore: TokenStore,
    private val json: Json,
) {
    private val sessionExpired = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val sessionExpiredEvents: SharedFlow<Unit> = sessionExpired.asSharedFlow()

    suspend fun hasSession(): Boolean = tokenStore.hasSession()

    suspend fun hasActiveCompanion(): Boolean {
        return when (val result = runCatching { api.listCompanions() }) {
            else -> {
                val envelope = result.getOrNull() ?: return false
                !envelope.data.isNullOrEmpty()
            }
        }
    }

    suspend fun login(email: String, password: String): AppResult<AuthSessionDto> {
        return execute {
            api.login(LoginRequest(email = email.trim().lowercase(), password = password))
        }
    }

    suspend fun register(
        displayName: String,
        email: String,
        password: String,
    ): AppResult<AuthSessionDto> {
        return execute {
            api.register(
                RegisterRequest(
                    email = email.trim().lowercase(),
                    password = password,
                    displayName = displayName.trim(),
                ),
            )
        }
    }

    suspend fun loginWithGoogle(idToken: String): AppResult<AuthSessionDto> {
        return execute { api.loginWithGoogle(GoogleAuthRequest(idToken = idToken)) }
    }

    suspend fun logout() {
        runCatching { api.logout() }
        tokenStore.clear()
    }

    suspend fun onSessionExpired() {
        tokenStore.clear()
        sessionExpired.tryEmit(Unit)
    }

    private suspend fun execute(
        block: suspend () -> ApiEnvelope<AuthSessionDto>,
    ): AppResult<AuthSessionDto> {
        return try {
            val envelope = block()
            val data = envelope.data
            if (!envelope.success || data == null) {
                AppResult.Err(AppError.Unknown(envelope.messageText()))
            } else {
                tokenStore.save(data.accessToken, data.refreshToken)
                AppResult.Ok(data)
            }
        } catch (error: HttpException) {
            AppResult.Err(mapHttp(error))
        } catch (_: SocketTimeoutException) {
            AppResult.Err(AppError.Timeout())
        } catch (_: UnknownHostException) {
            AppResult.Err(AppError.Offline())
        } catch (_: IOException) {
            AppResult.Err(AppError.Network("Couldn't reach the server. Try again."))
        } catch (error: Exception) {
            AppResult.Err(AppError.Unknown(error.message ?: "Something went wrong."))
        }
    }

    private fun mapHttp(error: HttpException): AppError {
        val raw = error.response()?.errorBody()?.string().orEmpty()
        val body = runCatching { json.decodeFromString(ApiErrorBody.serializer(), raw) }.getOrNull()
        val text = body?.let { ApiEnvelope<Unit>(false, it.statusCode, it.message, null, error = it.error).messageText() }
            ?: error.message()
        return when (error.code()) {
            401 -> AppError.Unauthorized(
                if (text.contains("invalid email or password", ignoreCase = true)) {
                    "Email or password is incorrect."
                } else {
                    text.ifBlank { "Email or password is incorrect." }
                },
            )
            409 -> AppError.Conflict(
                if (text.contains("already registered", ignoreCase = true)) {
                    "That email already has an account"
                } else {
                    text
                },
            )
            in 500..599 -> AppError.Server("Something went wrong on our end.")
            else -> AppError.Unknown(text.ifBlank { "Something went wrong." })
        }
    }
}
