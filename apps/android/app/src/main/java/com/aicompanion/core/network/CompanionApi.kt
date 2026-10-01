package com.aicompanion.core.network

import com.aicompanion.core.network.dto.AuthSessionDto
import com.aicompanion.core.network.dto.CompanionDto
import com.aicompanion.core.network.dto.GoogleAuthRequest
import com.aicompanion.core.network.dto.LoginRequest
import com.aicompanion.core.network.dto.MessageDto
import com.aicompanion.core.network.dto.RefreshRequest
import com.aicompanion.core.network.dto.RegisterRequest
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface CompanionApi {
    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): ApiEnvelope<AuthSessionDto>

    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): ApiEnvelope<AuthSessionDto>

    @POST("auth/google")
    suspend fun loginWithGoogle(@Body body: GoogleAuthRequest): ApiEnvelope<AuthSessionDto>

    @POST("auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): ApiEnvelope<AuthSessionDto>

    @POST("auth/logout")
    suspend fun logout(): ApiEnvelope<MessageDto>

    @GET("avatars")
    suspend fun listCompanions(): ApiEnvelope<List<CompanionDto>>
}

@Serializable
data class ApiErrorBody(
    val success: Boolean = false,
    val statusCode: Int = 500,
    val message: JsonElement? = null,
    val error: String? = null,
)
