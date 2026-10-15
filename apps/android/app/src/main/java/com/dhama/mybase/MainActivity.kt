package com.dhama.mybase

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.tooling.preview.Preview
import androidx.navigation.compose.rememberNavController
import com.dhama.mybase.core.navigation.AppNavHost
import com.dhama.mybase.ui.settings.rememberSettingsViewModel
import com.dhama.mybase.ui.theme.MyBaseTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val settings = rememberSettingsViewModel()
            val theme by settings.themeMode.collectAsState()
            val privacy by settings.screenPrivacy.collectAsState()
            val dark = when (theme) {
                "light" -> false
                "dark" -> true
                else -> isSystemInDarkTheme()
            }
            val view = LocalView.current
            DisposableEffect(privacy) {
                val window = view.context.findActivity()?.window
                // Screen privacy blocks screenshots. Debug builds stay capturable so
                // the emulator job can record the Maestro flows. Release still honors it.
                if (privacy && !BuildConfig.DEBUG) window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                else window?.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                onDispose { }
            }
            MyBaseTheme(darkTheme = dark) {
                Box(
                    Modifier
                        .fillMaxSize()
                        .semantics { testTagsAsResourceId = true },
                ) {
                    AppStart()
                }
            }
        }
    }
}
@Composable
fun AppStart() {
    val navController = rememberNavController()
    AppNavHost(navController)
}
private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

@Preview(showBackground = true)
@Composable
fun GreetingPreview() {
    MyBaseTheme {
        AppStart()
    }
}