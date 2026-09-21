package com.dhama.mybase

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import androidx.navigation.compose.rememberNavController
import com.dhama.mybase.core.navigation.AppNavHost
import com.dhama.mybase.ui.theme.MyBaseTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MyBaseTheme {
                AppStart()
            }
        }
    }
}
@Composable
fun AppStart() {
    val navController = rememberNavController()
    AppNavHost(navController)
}
@Preview(showBackground = true)
@Composable
fun GreetingPreview() {
    MyBaseTheme {
        AppStart()
    }
}