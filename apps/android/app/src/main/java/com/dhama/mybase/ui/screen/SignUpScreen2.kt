package com.dhama.mybase.ui.screen

import android.content.res.Configuration
import android.util.Log
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import com.dhama.mybase.R
import com.dhama.mybase.core.model.UiState
import com.dhama.mybase.ui.component.MyButton
import com.dhama.mybase.ui.screen.vm.OnBoardingViewModel
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SignUpScreen(
    onBack: () -> Unit,
    onSignUp: () -> Unit,
    onLogin: () -> Unit,
    viewModel: OnBoardingViewModel
) {
    var mobileSignUp by rememberSaveable { mutableStateOf(true) }
    val authState by viewModel.authState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val coroutineScope = rememberCoroutineScope()

    val context = LocalContext.current
    val credentialManager = CredentialManager.create(context)
    val webClientId = stringResource(R.string.default_web_client_id)
    LaunchedEffect(authState) {
        when (authState) {
            is UiState.Success -> {
                onSignUp()
            }

            is UiState.Error -> {
                coroutineScope.launch {
                    snackbarHostState.showSnackbar((authState as UiState.Error).message)
                }
            }

            else -> Unit
        }
    }

    SignUpContent(
        onBack = onBack,
        onSignUp = { email, password ->
            viewModel.createEmailSignIn(email, password)
        },
        onMobileSignUp = { mobile ->
            viewModel.sendOtp(mobile, context as androidx.activity.ComponentActivity)
        },
        onLogin = onLogin,
        googleSignIn = {
            val request = GetCredentialRequest.Builder()
                .addCredentialOption(
                    GetGoogleIdOption.Builder()
                        .setFilterByAuthorizedAccounts(false)
                        .setServerClientId(webClientId)
                        .setAutoSelectEnabled(false)
                        // nonce string to use when generating a Google ID token
                        //.setNonce(nonce)
                        .build()
                )
                .build()
            coroutineScope.launch { // Launch a coroutine
                val response = credentialManager.getCredential(request = request, context = context)
                viewModel.googleSignIn(response)
            }

        },
        facebookSignIn = { },
        twitterSignIn = { },
        isValidEmail = { viewModel.isValidEmail(it) },
        isStrongPassword = { viewModel.isStrongPassword(it) },
        isValidMobile = { viewModel.isValidMobile(it) },
        authState = authState,
        mobileSignUp,
        updateMobileSignUp = { mobileSignUp = it }
    )
}

@Composable
fun SignUpContent(
    onBack: () -> Unit,
    onSignUp: (email: String, password: String) -> Unit,
    onMobileSignUp: (mobile: String) -> Unit,
    onLogin: () -> Unit,
    googleSignIn: () -> Unit,
    facebookSignIn: () -> Unit,
    twitterSignIn: () -> Unit,
    isValidEmail: (email: String) -> Boolean,
    isStrongPassword: (password: String) -> Boolean,
    isValidMobile: (mobile: String) -> Boolean,
    authState: UiState<String>,
    mobileSignUp: Boolean,
    updateMobileSignUp: (value: Boolean) -> Unit
) {
    val focus = LocalFocusManager.current
    var email by rememberSaveable { mutableStateOf("") }
    var mobile by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var confirm by rememberSaveable { mutableStateOf("") }
    var showPassword by rememberSaveable { mutableStateOf(false) }
    var showConfirm by rememberSaveable { mutableStateOf(false) }

    val snackbarHostState = remember { SnackbarHostState() }


    val mobileError = mobile.isNotBlank() && !isValidMobile(mobile)
    val emailError = email.isNotBlank() && !isValidEmail(email)
    val passwordError = password.isNotBlank() && !isStrongPassword(password)
    val confirmError = confirm.isNotBlank() && confirm != password
    val canSubmit = isValidEmail(email) && isStrongPassword(password) && confirm == password


    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { paddingValues ->
        println("paddingValues: $paddingValues")
        Log.d("SignUpContent", "paddingValues: $paddingValues")
        Column(
            modifier = Modifier
                .fillMaxSize()
                .imePadding()
                .systemBarsPadding()
                .padding(horizontal = 24.dp)
                //  .safeContentPadding()
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Logo (Replace with your actual logo)
            // For demonstration, using a placeholder. You'd use painterResource(R.drawable.your_logo)

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 16.dp),
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack, // Replace with your logo
                    contentDescription = "Back",
                    modifier = Modifier
                        .clickable { onBack() }
                )
            }

//
            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Welcome!",
                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold)
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Create your account",
                style = MaterialTheme.typography.bodyLarge.copy(color = Color.Gray)
            )

            Spacer(modifier = Modifier.height(32.dp))

            if (mobileSignUp) {
                TextField(
                    value = mobile,
                    onValueChange = { mobile = it },
                    label = { Text("Mobile Number") },
                    leadingIcon = { Icon(Icons.Default.Phone, contentDescription = "Phone Icon") },
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Phone,
                        imeAction = ImeAction.Next
                    ),
                    keyboardActions = KeyboardActions(
                        onNext = { focus.moveFocus(FocusDirection.Down) }
                    ),
                    singleLine = true,
                    isError = mobileError,
                    supportingText = {
                        if (mobileError) {
                            Text(
                                text = "Enter a valid mobile number",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                    },
                    colors = TextFieldDefaults.colors(
                        focusedIndicatorColor = MaterialTheme.colorScheme.primary,
                        unfocusedIndicatorColor = Color.LightGray,
                        focusedLeadingIconColor = MaterialTheme.colorScheme.primary,
                        unfocusedLeadingIconColor = MaterialTheme.colorScheme.onSurface,
                        focusedContainerColor = Color.Transparent,
                        unfocusedContainerColor = Color.Transparent
                    )
                )
            } else {
                // Email Field
                TextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email") },
                    leadingIcon = { Icon(Icons.Default.Email, contentDescription = "Email Icon") },
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth(),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Email,
                        imeAction = ImeAction.Next
                    ),
                    keyboardActions = KeyboardActions(
                        onNext = { focus.moveFocus(FocusDirection.Down) }
                    ),
                    singleLine = true,
                    isError = emailError,
                    supportingText = {
                        if (emailError) {
                            Text(
                                text = "Enter a valid email address",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                    },
                    colors = TextFieldDefaults.colors(
                        focusedIndicatorColor = MaterialTheme.colorScheme.primary,
                        unfocusedIndicatorColor = Color.LightGray,
                        focusedLeadingIconColor = MaterialTheme.colorScheme.primary,
                        unfocusedLeadingIconColor = MaterialTheme.colorScheme.onSurface,
                        focusedContainerColor = Color.Transparent,
                        unfocusedContainerColor = Color.Transparent
                    )
                )
                Spacer(modifier = Modifier.height(16.dp))

                // Password Field
                TextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("Password") },
                    leadingIcon = {
                        Icon(
                            Icons.Default.Lock,
                            contentDescription = "Password Icon"
                        )
                    },
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    isError = passwordError,
                    supportingText = {
                        if (passwordError) {
                            Text(
                                text = "Min 8 chars, include a letter and a digit",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                    },
                    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    colors = TextFieldDefaults.colors(
                        focusedIndicatorColor = MaterialTheme.colorScheme.primary,
                        unfocusedIndicatorColor = Color.LightGray,
                        focusedLeadingIconColor = MaterialTheme.colorScheme.primary,
                        unfocusedLeadingIconColor = MaterialTheme.colorScheme.onSurface,
                        focusedTrailingIconColor = MaterialTheme.colorScheme.primary,
                        unfocusedTrailingIconColor = MaterialTheme.colorScheme.onSurface,
                        focusedContainerColor = Color.Transparent,
                        unfocusedContainerColor = Color.Transparent
                    ),
                    trailingIcon = {
                        IconButton(
                            onClick = { showPassword = !showPassword },
                            modifier = Modifier.semantics {
                                contentDescription =
                                    if (showPassword) "Hide password" else "Show password"
                            }
                        ) {
                            Icon(
                                imageVector = if (showPassword) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                                contentDescription = null
                            )
                        }
                    },
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Next
                    ),
                    keyboardActions = KeyboardActions(
                        onNext = { focus.moveFocus(FocusDirection.Down) }
                    ),
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Confirm password
                TextField(
                    value = confirm,
                    onValueChange = { confirm = it },
                    label = { Text("Confirm Password") },
                    leadingIcon = {
                        Icon(
                            Icons.Default.Lock,
                            contentDescription = "Password Icon"
                        )
                    },
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    isError = confirmError,
                    supportingText = {
                        if (confirmError) {
                            Text(
                                text = "Passwords do not match",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                    },
                    visualTransformation = if (showConfirm) VisualTransformation.None else PasswordVisualTransformation(),
                    colors = TextFieldDefaults.colors(
                        focusedIndicatorColor = MaterialTheme.colorScheme.primary,
                        unfocusedIndicatorColor = Color.LightGray,
                        focusedLeadingIconColor = MaterialTheme.colorScheme.primary,
                        unfocusedLeadingIconColor = MaterialTheme.colorScheme.onSurface,
                        focusedTrailingIconColor = MaterialTheme.colorScheme.primary,
                        unfocusedTrailingIconColor = MaterialTheme.colorScheme.onSurface,
                        focusedContainerColor = Color.Transparent,
                        unfocusedContainerColor = Color.Transparent
                    ),
                    trailingIcon = {
                        IconButton(
                            onClick = { showConfirm = !showConfirm },
                            modifier = Modifier.semantics {
                                contentDescription =
                                    if (showConfirm) "Hide password" else "Show password"
                            }
                        ) {
                            Icon(
                                imageVector = if (showConfirm) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                                contentDescription = null
                            )
                        }
                    },
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done
                    ),
                    keyboardActions = KeyboardActions(
                        onDone = {
                            if (canSubmit) onSignUp(email.trim(), password)
                        }
                    ),
                )
            }



            Spacer(modifier = Modifier.height(32.dp))


            // Sign Up Button
            MyButton(
                loading = authState is UiState.Loading,
                text = "Sign up",
                textLoading = "Signing up..."
            ) {
                if (mobileSignUp)
                    onSignUp(email, password)
                else
                    onSignUp(mobile, password)
            }


            Spacer(modifier = Modifier.height(32.dp))

            // "Or sign up with" Divider
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Spacer(modifier = Modifier
                    .weight(1f)
                    .height(1.dp)
                    .background(Color.LightGray)
                )
               // Divider(modifier = Modifier.weight(1f), color = Color.LightGray, thickness = 1.dp)
                Text(
                    text = " Or sign up with ",
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

            // Social Sign-up Buttons
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                SocialLoginButton(iconRes = R.drawable.ic_google, "Sign up with google") {
                    /* Handle Google Sign Up */
                    googleSignIn()
                }
                if (mobileSignUp) {
                    SocialLoginButton(iconRes = R.drawable.outline_mail_24, "Sign up with email") {
                        /* Handle Facebook Sign Up */
                        updateMobileSignUp(false)
                    }
                } else {
                    SocialLoginButton(
                        iconRes = R.drawable.baseline_phone_24,
                        "Sign up with mobile"
                    ) {
                        /* Handle Twitter Sign Up */
                        updateMobileSignUp(true)
                    }
                }
            }

            Spacer(modifier = Modifier.height(48.dp)) // More space before "Don't have an account?"

            // Don't have an account? Sign up here
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(text = "Already have an account?", color = Color.Gray)
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "Login here",
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.clickable { onLogin() } // Call the provided lambda
                )
            }
        }
    }
}

@Composable
fun SocialLoginButton(iconRes: Int, label: String, onClick: () -> Unit) {

    Button(
        onClick = { onClick() },
        modifier = Modifier
            .fillMaxWidth(),
        // .border(0.5.dp, MaterialTheme.colorScheme.onBackground, RoundedCornerShape(24.dp)),
        shape = RoundedCornerShape(8.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.background
        ),
        elevation = ButtonDefaults.buttonElevation(4.dp),
        contentPadding = PaddingValues(vertical = 12.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Image(
                painter = painterResource(id = iconRes),
                contentDescription = null, // Content description for accessibility
                modifier = Modifier.size(36.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = label,
                color = MaterialTheme.colorScheme.onBackground
            )
        }
    }


//    ElevatedCard(
//        onClick = onClick,
//        modifier = Modifier
//            .fillMaxWidth()
//            .height(60.dp),
//        shape = RoundedCornerShape(16.dp),
//        elevation = CardDefaults.elevatedCardElevation(defaultElevation = 4.dp),
//        colors = CardDefaults.elevatedCardColors(containerColor = Color.White)
//    ) {
//        Row(
//            modifier = Modifier.fillMaxSize(),
//            verticalAlignment = Alignment.CenterVertically,
//            horizontalArrangement = Arrangement.Center
//        ) {
//            Image(
//                painter = painterResource(id = iconRes),
//                contentDescription = null, // Content description for accessibility
//                modifier = Modifier.size(36.dp)
//            )
//            Spacer(modifier = Modifier.width(16.dp))
//            Text(text = "Sign up with google")
//        }
//    }
}




@Preview(
    name = "SignUp – Light",
    showSystemUi = true,
    uiMode = Configuration.UI_MODE_NIGHT_NO
)
@Preview(
    name = "SignUp – Dark",
    showSystemUi = true,
    uiMode = Configuration.UI_MODE_NIGHT_YES
)
@Composable
fun PreviewSignUpScreen() {
    val sampleState = MutableStateFlow<UiState<String>>(UiState.Loading).collectAsState().value
    SignUpContent(
        onBack = { },
        onSignUp = { _, _ -> },
        onMobileSignUp = { _ -> },
        onLogin = { },
        googleSignIn = { },
        facebookSignIn = { },
        twitterSignIn = { },
        isValidEmail = { true },
        isStrongPassword = { true },
        isValidMobile = { true },
        authState = sampleState,
        mobileSignUp = true,
        updateMobileSignUp = { }
    )
}