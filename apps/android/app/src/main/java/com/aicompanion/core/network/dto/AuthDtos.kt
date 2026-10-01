package com.aicompanion.core.network.dto

import com.aicompanion.core.common.FlexibleStringSerializer
import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
)

@Serializable
data class RegisterRequest(
    val email: String,
    val password: String,
    val displayName: String,
)

@Serializable
data class RefreshRequest(
    val refreshToken: String,
)

@Serializable
data class GoogleAuthRequest(
    val idToken: String,
)

@Serializable
data class AuthUserDto(
    @Serializable(with = FlexibleStringSerializer::class)
    val id: String,
    val email: String,
    val displayName: String? = null,
)

@Serializable
data class AuthSessionDto(
    val user: AuthUserDto,
    val accessToken: String,
    val refreshToken: String,
)

@Serializable
data class MessageDto(
    val message: String? = null,
)

@Serializable
data class CompanionDto(
    @Serializable(with = FlexibleStringSerializer::class)
    val id: String,
    val name: String? = null,
    val status: String? = null,
)
