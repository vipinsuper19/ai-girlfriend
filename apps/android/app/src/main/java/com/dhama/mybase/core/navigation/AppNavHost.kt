package com.dhama.mybase.core.navigation

import android.util.Log
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Modifier
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.dhama.mybase.ui.screen.HomeScreen
import com.dhama.mybase.ui.screen.LoginScreen
import com.dhama.mybase.ui.screen.SignUpScreen
import com.dhama.mybase.ui.screen.SplashScreen
import com.dhama.mybase.ui.screen.WelcomeScreen
import com.dhama.mybase.ui.screen.vm.OnBoardingViewModel

@Composable
fun AppNavHost(
    navController: NavHostController,
    modifier: Modifier = Modifier,
) {
    NavHost(navController = navController, startDestination = Splash) {
        composable<Splash> {
            SplashScreen(onSplashComplete = {
                navController.navigate(Gate) {
                    popUpTo(Splash) { inclusive = true }
                }
            })
        }

        // Gate → Onboarding or Main
        composable<Gate> {
            // Replace with real checks (first run / auth)
            val viewModel: OnBoardingViewModel = hiltViewModel() // Injected ViewModel
            val isLoggedIn = viewModel.getLoggedInStatus().collectAsState(initial = false).value
            val isGoalSet = viewModel.getGoalStatus().collectAsState(initial = false).value
            Log.d("TAG", "AppNavHost: isLoggedIn $isLoggedIn isGoalSet $isGoalSet")
            LaunchedEffect(Unit) {
                when {
                    !isLoggedIn -> navController.navigate(Welcome) {
                        popUpTo(Gate) { inclusive = true }
                    }
                    !isGoalSet -> navController.navigate(Home) {
                        popUpTo(Gate) { inclusive = true }
                    }
                    else -> navController.navigate(Home) {
                        popUpTo(Gate) { inclusive = true }
                    }
                }
            }
        }

        // Onboarding
        composable<Welcome> {
            WelcomeScreen(
                onGetStarted = { navController.navigate(SignUp) },
                onSkip = {
                    navController.navigate(Home) { popUpTo(Welcome) { inclusive = true } }
                },
                onLogin = { navController.navigate(Login) }
            )
        }

        composable<SignUp> {
            val viewModel: OnBoardingViewModel = hiltViewModel() // Injected ViewModel
            SignUpScreen(
                onBack = { navController.popBackStack() },
                onSignUp = {
                    navController.navigate(Home) {
                        popUpTo(SignUp) { inclusive = true }
                    }
                },
                onLogin = {
                    navController.navigate(Login) {
                        popUpTo(SignUp) { inclusive = true }
                    }
                },
                viewModel
            )
        }

        composable<Login> {
            val viewModel: OnBoardingViewModel = hiltViewModel() // Injected ViewModel
            LoginScreen(
                onBack = { navController.popBackStack() },
                onLogin = {
                    navController.navigate(Home) {
                        popUpTo(SignUp) { inclusive = true }
                    }
                },
                onSignUp = {
                    navController.navigate(SignUp) {
                        popUpTo(Login) { inclusive = true }
                    }
                },
                onForgotPassword = { },
                viewModel
            )
        }

        composable<Home> {
            HomeScreen()
        }

    }
}
