package com.aicompanion.core.common

sealed class AppResult<out T> {
    data class Ok<T>(val value: T) : AppResult<T>()
    data class Err(val error: AppError) : AppResult<Nothing>()
}

sealed class AppError {
    data class Validation(val fieldErrors: Map<String, String>, val banner: String? = null) : AppError()
    data class Unauthorized(val message: String) : AppError()
    data class Conflict(val message: String) : AppError()
    data class Network(val message: String) : AppError()
    data class Offline(val message: String = "You're offline. Connect to a network to continue.") : AppError()
    data class Server(val message: String) : AppError()
    data class Timeout(val message: String = "That took too long.") : AppError()
    data class Cancelled(val message: String = "") : AppError()
    data class Unknown(val message: String) : AppError()

    fun bannerText(): String = when (this) {
        is Validation -> banner ?: fieldErrors.values.firstOrNull() ?: "Please check the form."
        is Unauthorized -> message
        is Conflict -> message
        is Network -> message
        is Offline -> message
        is Server -> message
        is Timeout -> message
        is Cancelled -> message
        is Unknown -> message
    }
}
