package com.aicompanion.core.network

import com.aicompanion.core.data.AuthRepository
import com.aicompanion.core.data.TokenStore
import com.aicompanion.core.di.UnauthenticatedApi
import com.aicompanion.core.network.dto.RefreshRequest
import java.util.concurrent.atomic.AtomicBoolean
import javax.inject.Inject
import javax.inject.Provider
import javax.inject.Singleton
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route

@Singleton
class TokenAuthenticator @Inject constructor(
    private val tokenStore: TokenStore,
    @UnauthenticatedApi private val refreshApi: CompanionApi,
    private val authRepository: Provider<AuthRepository>,
) : Authenticator {
    private val mutex = Mutex()
    private val clearing = AtomicBoolean(false)

    override fun authenticate(route: Route?, response: Response): Request? {
        if (responseCount(response) >= 2) return null
        val path = response.request.url.encodedPath
        if (path.contains("/auth/refresh") ||
            path.contains("/auth/login") ||
            path.contains("/auth/register") ||
            path.contains("/auth/google")
        ) {
            return null
        }
        return runBlocking {
            mutex.withLock {
                val currentAccess = tokenStore.accessToken()
                val failedAccess = response.request.header("Authorization")?.removePrefix("Bearer ")
                if (!currentAccess.isNullOrBlank() && currentAccess != failedAccess) {
                    return@withLock response.request.newBuilder()
                        .header("Authorization", "Bearer $currentAccess")
                        .build()
                }
                val refresh = tokenStore.refreshToken()
                if (refresh.isNullOrBlank()) {
                    expire()
                    return@withLock null
                }
                val data = runCatching {
                    refreshApi.refresh(RefreshRequest(refresh))
                }.getOrNull()?.data
                if (data == null) {
                    expire()
                    null
                } else {
                    tokenStore.save(data.accessToken, data.refreshToken)
                    response.request.newBuilder()
                        .header("Authorization", "Bearer ${data.accessToken}")
                        .build()
                }
            }
        }
    }

    private suspend fun expire() {
        if (clearing.compareAndSet(false, true)) {
            authRepository.get().onSessionExpired()
            clearing.set(false)
        }
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }
}
