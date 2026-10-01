package com.dhama.mybase.core.model

// open class UiState {
//
//    object Loading : UiState()
//    object Success : UiState()
//    data class Error(val message: String) : UiState()
//
//}

sealed class UiState<out T> {

    object Start : UiState<Nothing>()
    object Loading : UiState<Nothing>()
    data class Success<out T>(val data: T) : UiState<T>()
    data class Error(val message: String) : UiState<Nothing>()
}