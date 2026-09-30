package com.dhama.mybase.core.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.dhama.mybase.ui.home.MainShell
import com.dhama.mybase.ui.home.PostAuthDestination
import com.dhama.mybase.ui.home.PostAuthViewModel
import com.dhama.mybase.ui.onboarding.CompanionWizardScreen
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

        composable<Gate> {
            val viewModel: PostAuthViewModel = hiltViewModel()
            LaunchedEffect(Unit) {
                val destination = when (viewModel.destination()) {
                    PostAuthDestination.Welcome -> Welcome
                    PostAuthDestination.Onboarding -> Onboarding
                    PostAuthDestination.Home -> Main
                }
                navController.navigate(destination) {
                    popUpTo(Gate) { inclusive = true }
                }
            }
        }

        // Onboarding
        composable<Welcome> {
            WelcomeScreen(
                onGetStarted = { navController.navigate(SignUp) },
                onSkip = {
                    navController.navigate(Onboarding)
                },
                onLogin = { navController.navigate(Login) }
            )
        }

        composable<SignUp> {
            val viewModel: OnBoardingViewModel = hiltViewModel() // Injected ViewModel
            SignUpScreen(
                onBack = { navController.popBackStack() },
                onSignUp = {
                    navController.navigate(Gate) {
                        popUpTo(Welcome) { inclusive = true }
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
                    navController.navigate(Gate) {
                        popUpTo(Welcome) { inclusive = true }
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

        composable<Onboarding> {
            CompanionWizardScreen(
                onExit = { navController.popBackStack() },
                onCreated = {
                    navController.navigate(Main) {
                        popUpTo(Onboarding) { inclusive = true }
                    }
                },
            )
        }

        composable<Main> {
            MainShell(
                onLoggedOut = {
                    navController.navigate(Welcome) {
                        popUpTo(Main) { inclusive = true }
                    }
                },
            )
        }

        composable<Home> {
            MainShell(
                onLoggedOut = {
                    navController.navigate(Welcome) {
                        popUpTo(Home) { inclusive = true }
                    }
                },
            )
        }

    }
}
