package com.aicompanion.feature.auth

import android.view.WindowManager
import androidx.activity.compose.BackHandler
import androidx.activity.compose.LocalActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.aicompanion.core.designsystem.components.BannerTone
import com.aicompanion.core.designsystem.components.CompanionTextButton
import com.aicompanion.core.designsystem.components.CompanionTextField
import com.aicompanion.core.designsystem.components.PasswordField
import com.aicompanion.core.designsystem.components.PrimaryButton
import com.aicompanion.core.designsystem.components.StatusBanner

@Composable
fun EmailLoginRoute(
    onBack: () -> Unit,
    onAuthenticated: (home: Boolean) -> Unit,
    onGoogle: () -> Unit,
    viewModel: EmailLoginViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val activity = LocalActivity.current
    DisposableEffect(activity) {
        activity?.window?.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE,
        )
        onDispose { activity?.window?.clearFlags(WindowManager.LayoutParams.FLAG_SECURE) }
    }
    LaunchedEffect(Unit) {
        viewModel.navEvents.collect { event ->
            when (event) {
                AuthNavEvent.Home -> onAuthenticated(true)
                AuthNavEvent.Onboarding -> onAuthenticated(false)
                AuthNavEvent.GoogleLogin -> onGoogle()
                else -> Unit
            }
        }
    }
    BackHandler(enabled = state.submitting) { }
    EmailLoginScreen(
        state = state,
        passwordResetEnabled = viewModel.passwordResetEnabled,
        onBack = onBack,
        onEmailChange = viewModel::onEmailChange,
        onPasswordChange = viewModel::onPasswordChange,
        onSubmit = viewModel::submit,
        onGoogle = viewModel::onGoogleOnlyAction,
    )
}

@Composable
fun EmailLoginScreen(
    state: AuthFormState,
    passwordResetEnabled: Boolean,
    onBack: () -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onGoogle: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp),
    ) {
        IconButton(onClick = onBack, enabled = !state.submitting) {
            Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
        }
        Text("Sign in with email", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(6.dp))
        Text(
            text = "Use the address and password you signed up with.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        Spacer(Modifier.height(18.dp))
        if (state.banner != null) {
            StatusBanner(
                text = state.banner,
                tone = if (state.warning) BannerTone.Warning else BannerTone.Error,
                actionLabel = state.bannerAction,
                onAction = if (state.bannerAction != null) onGoogle else null,
            )
            Spacer(Modifier.height(14.dp))
        }
        CompanionTextField(
            value = state.email,
            onValueChange = onEmailChange,
            label = "Email",
            errorText = state.emailError,
            enabled = !state.submitting,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Email,
                imeAction = ImeAction.Next,
                autoCorrectEnabled = false,
            ),
        )
        PasswordField(
            value = state.password,
            onValueChange = onPasswordChange,
            label = "Password",
            errorText = state.passwordError,
            enabled = !state.submitting,
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Password,
                imeAction = ImeAction.Done,
            ),
            keyboardActions = KeyboardActions(onDone = { onSubmit() }),
        )
        if (passwordResetEnabled) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Spacer(Modifier.weight(1f))
                CompanionTextButton(text = "Forgot password?", onClick = {}, enabled = !state.submitting)
            }
        }
        Spacer(Modifier.height(8.dp))
        PrimaryButton(
            text = if (state.submitting) "Logging in" else "Log in",
            onClick = onSubmit,
            loading = state.submitting,
        )
        Spacer(Modifier.height(12.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Spacer(Modifier.weight(1f))
            Text("Prefer Google?", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            CompanionTextButton(text = "Go back", onClick = onBack, enabled = !state.submitting)
            Spacer(Modifier.weight(1f))
        }
        Spacer(Modifier.height(24.dp))
    }
}
