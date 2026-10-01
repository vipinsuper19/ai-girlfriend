package com.aicompanion.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.rememberCoroutineScope
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.navigation
import androidx.navigation.compose.rememberNavController
import com.aicompanion.core.data.AuthRepository
import com.aicompanion.feature.auth.EmailLoginRoute
import com.aicompanion.feature.auth.GoogleLoginRoute
import com.aicompanion.feature.auth.SignupRoute
import com.aicompanion.feature.auth.WelcomeScreen
import com.aicompanion.feature.auth.WelcomeViewModel
import com.aicompanion.feature.placeholder.PlaceholderScreen
import com.aicompanion.feature.splash.SplashRoute
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

@Composable
fun CompanionNavHost(
    authRepository: AuthRepository,
    navController: NavHostController = rememberNavController(),
) {
    val scope = rememberCoroutineScope()

    LaunchedEffect(authRepository) {
        authRepository.sessionExpiredEvents.collectLatest {
            navController.navigate(AuthGraphRoute) {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    fun afterAuth(home: Boolean) {
        navController.navigate(if (home) HomeRoute else OnboardingRoute) {
            popUpTo(AuthGraphRoute) { inclusive = true }
        }
    }

    fun logout() {
        scope.launch {
            authRepository.logout()
            navController.navigate(AuthGraphRoute) {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    NavHost(
        navController = navController,
        startDestination = SplashRoute,
    ) {
        composable<SplashRoute> {
            SplashRoute(
                onWelcome = {
                    navController.navigate(AuthGraphRoute) {
                        popUpTo(SplashRoute) { inclusive = true }
                    }
                },
                onOnboarding = {
                    navController.navigate(OnboardingRoute) {
                        popUpTo(SplashRoute) { inclusive = true }
                    }
                },
                onHome = {
                    navController.navigate(HomeRoute) {
                        popUpTo(SplashRoute) { inclusive = true }
                    }
                },
            )
        }
        navigation<AuthGraphRoute>(startDestination = WelcomeRoute) {
            composable<WelcomeRoute> {
                val welcomeViewModel: WelcomeViewModel = hiltViewModel()
                WelcomeScreen(
                    onGetStarted = { navController.navigate(SignupRoute) },
                    onLogin = {
                        if (welcomeViewModel.googleAvailable) {
                            navController.navigate(LoginRoute)
                        } else {
                            navController.navigate(LoginEmailRoute())
                        }
                    },
                )
            }
            composable<LoginRoute> {
                GoogleLoginRoute(
                    onBack = { navController.popBackStack() },
                    onEmail = { email -> navController.navigate(LoginEmailRoute(email)) },
                    onSignup = { navController.navigate(SignupRoute) },
                    onAuthenticated = ::afterAuth,
                )
            }
            composable<LoginEmailRoute> {
                EmailLoginRoute(
                    onBack = { navController.popBackStack() },
                    onAuthenticated = ::afterAuth,
                    onGoogle = {
                        if (!navController.popBackStack(LoginRoute, inclusive = false)) {
                            navController.navigate(LoginRoute)
                        }
                    },
                )
            }
            composable<SignupRoute> {
                SignupRoute(
                    onBack = { navController.popBackStack() },
                    onLogin = { email ->
                        navController.navigate(LoginEmailRoute(email)) {
                            popUpTo(WelcomeRoute)
                        }
                    },
                    onAuthenticated = { afterAuth(home = false) },
                )
            }
        }
        composable<OnboardingRoute> {
            PlaceholderScreen(
                title = "Onboarding",
                body = "You're in. Companion creation comes next.",
                action = "Log out",
                onAction = ::logout,
            )
        }
        composable<HomeRoute> {
            PlaceholderScreen(
                title = "Home",
                body = "You're signed in. Chat and home land here next.",
                action = "Log out",
                onAction = ::logout,
            )
        }
    }
}
