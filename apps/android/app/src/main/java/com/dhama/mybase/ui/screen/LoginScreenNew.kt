package com.dhama.mybase.ui.screen

import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel

// Assuming you have these drawable resources. Replace with actual resource IDs.
// For example, R.drawable.ic_google, R.drawable.ic_facebook, R.drawable.ic_twitter
// For demonstration, let's use dummy resource IDs or remove the image part if not available.
// If you don't have actual drawables, you might need to create placeholders or omit them.
import com.dhama.mybase.R // Replace with your actual R file path
import com.dhama.mybase.core.model.UiState
import com.dhama.mybase.ui.screen.vm.OnBoardingViewModel
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    onBack: () -> Unit,
    onLogin: () -> Unit,
    onSignUp: () -> Unit = {}, // Lambda for navigating to sign-up screen
    onForgotPassword: () -> Unit,
    viewModel: OnBoardingViewModel
) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    val authState by viewModel.authState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(authState) {
        when (authState) {
            is UiState.Success -> {
                onLogin()
            }
            is UiState.Error -> {
                coroutineScope.launch {
                    snackbarHostState.showSnackbar(
                        message = (authState as UiState.Error).message,
                        duration = SnackbarDuration.Short // Or Indefinite, Long
                    )
                }
            }
            else -> Unit
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Logo (Replace with your actual logo)
        Image(
            painter = painterResource(id = R.drawable.app_logo_no_text), // Replace with your logo
            contentDescription = "App Logo",
            modifier = Modifier.size(100.dp)
        )

        Spacer(modifier = Modifier.height(32.dp))

        Text(
            text = "Welcome back!",
            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Login to your account",
            style = MaterialTheme.typography.bodyLarge.copy(color = Color.Gray)
        )

        Spacer(modifier = Modifier.height(32.dp))

        // Username Field
        OutlinedTextField(
            value = username,
            onValueChange = { username = it },
            label = { Text("Username") },
            leadingIcon = { Icon(Icons.Default.Person, contentDescription = "Username Icon") },
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            colors = TextFieldDefaults.colors(
                focusedIndicatorColor = MaterialTheme.colorScheme.primary,
                unfocusedIndicatorColor = Color.LightGray
            )
        )
        Spacer(modifier = Modifier.height(16.dp))

        // Password Field
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            leadingIcon = { Icon(Icons.Default.Lock, contentDescription = "Password Icon") },
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            visualTransformation = PasswordVisualTransformation(),
            singleLine = true,
            colors = TextFieldDefaults.colors(
                focusedIndicatorColor = MaterialTheme.colorScheme.primary,
                unfocusedIndicatorColor = Color.LightGray
            )
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End
        ) {
            TextButton(onClick = onForgotPassword) {
                Text("Forgot password?")
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (authState is UiState.Loading) {
            CircularProgressIndicator()
            Spacer(modifier = Modifier.height(32.dp))
        }
        // Sign In Button
        Button(
            onClick = { viewModel.emailSignIn(username,password) },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(24.dp),
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
            contentPadding = PaddingValues(vertical = 12.dp)
        ) {
            Text(text = "Sign in", fontSize = 18.sp)
        }

        Spacer(modifier = Modifier.height(32.dp))

        // "Or sign in with" Divider
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            HorizontalDivider(
                modifier = Modifier.weight(1f),
                thickness = 1.dp,
                color = Color.LightGray
            )
            Text(
                text = " Or sign in with ",
                modifier = Modifier.padding(horizontal = 8.dp),
                color = Color.Gray
            )
            HorizontalDivider(
                modifier = Modifier.weight(1f),
                thickness = 1.dp,
                color = Color.LightGray
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Social Sign-in Buttons
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceAround
        ) {
            SocialLoginButton(iconRes = R.drawable.ic_google,"Signup with google") { /* Handle Google Sign In */ }
            SocialLoginButton(iconRes = R.drawable.ic_facebook,"Signup with facebook") { /* Handle Facebook Sign In */ }
            SocialLoginButton(iconRes = R.drawable.ic_twitter,"Signup with twiiter") { /* Handle Twitter Sign In */ }
        }

        Spacer(modifier = Modifier.height(48.dp)) // More space before "Don't have an account?"

        // Don't have an account? Sign up here
        Row(
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(text = "Don't have an account?", color = Color.Gray)
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = "Sign up here",
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.clickable { onSignUp() } // Call the provided lambda
            )
        }
    }
}

//@Composable
//fun SocialLoginButton(iconRes: Int, onClick: () -> Unit) {
//    ElevatedCard(
//        onClick = onClick,
//        modifier = Modifier.size(60.dp),
//        shape = RoundedCornerShape(16.dp),
//        elevation = CardDefaults.elevatedCardElevation(defaultElevation = 4.dp),
//        colors = CardDefaults.elevatedCardColors(containerColor = Color.White)
//    ) {
//        Box(
//            modifier = Modifier.fillMaxSize(),
//            contentAlignment = Alignment.Center
//        ) {
//            Image(
//                painter = painterResource(id = iconRes),
//                contentDescription = null, // Content description for accessibility
//                modifier = Modifier.size(36.dp)
//            )
//        }
//    }
//}

@Preview(showBackground = true)
@Composable
fun PreviewLoginScreen() {
    LoginScreen(
        onBack = {},
        onLogin = {},
        onSignUp = {  },
        onForgotPassword = {  },
        viewModel = viewModel()
    )
}