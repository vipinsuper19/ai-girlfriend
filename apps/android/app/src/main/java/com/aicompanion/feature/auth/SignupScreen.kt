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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.Checkbox
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.aicompanion.core.designsystem.components.BannerTone
import com.aicompanion.core.designsystem.components.CompanionTextButton
import com.aicompanion.core.designsystem.components.CompanionTextField
import com.aicompanion.core.designsystem.components.PasswordField
import com.aicompanion.core.designsystem.components.PasswordStrengthMeter
import com.aicompanion.core.designsystem.components.PrimaryButton
import com.aicompanion.core.designsystem.components.StatusBanner

@Composable
fun SignupRoute(
    onBack: () -> Unit,
    onLogin: (String) -> Unit,
    onAuthenticated: () -> Unit,
    viewModel: SignupViewModel = hiltViewModel(),
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
                AuthNavEvent.Onboarding -> onAuthenticated()
                is AuthNavEvent.EmailLogin -> onLogin(event.email)
                else -> Unit
            }
        }
    }
    BackHandler(enabled = state.submitting) { }
    SignupScreen(
        state = state,
        onBack = onBack,
        onNameChange = viewModel::onNameChange,
        onEmailChange = viewModel::onEmailChange,
        onPasswordChange = viewModel::onPasswordChange,
        onTermsChange = viewModel::onTermsChange,
        onSubmit = viewModel::submit,
        onLogin = viewModel::loginInstead,
    )
}

@Composable
fun SignupScreen(
    state: AuthFormState,
    onBack: () -> Unit,
    onNameChange: (String) -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onTermsChange: (Boolean) -> Unit,
    onSubmit: () -> Unit,
    onLogin: () -> Unit,
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
        Text("Create your account", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(18.dp))
        if (state.banner != null) {
            StatusBanner(
                text = state.banner,
                tone = if (state.warning) BannerTone.Warning else BannerTone.Error,
            )
            Spacer(Modifier.height(14.dp))
        }
        CompanionTextField(
            value = state.name,
            onValueChange = onNameChange,
            label = "Your name",
            errorText = state.nameError,
            enabled = !state.submitting,
            keyboardOptions = KeyboardOptions(
                capitalization = KeyboardCapitalization.Words,
                imeAction = ImeAction.Next,
            ),
        )
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
        if (state.emailError?.contains("already") == true) {
            CompanionTextButton(text = "Log in instead", onClick = onLogin)
        }
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
        )
        PasswordStrengthMeter(password = state.password)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(
                checked = state.acceptedTerms,
                onCheckedChange = onTermsChange,
                enabled = !state.submitting,
            )
            Spacer(Modifier.width(4.dp))
            Text(
                text = "I agree to the Terms and Privacy Policy.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
        if (state.termsError != null) {
            Text(
                text = state.termsError,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(start = 4.dp, bottom = 8.dp),
            )
        }
        Spacer(Modifier.height(8.dp))
        PrimaryButton(
            text = "Create account",
            onClick = onSubmit,
            loading = state.submitting,
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Spacer(Modifier.weight(1f))
            Text("Already have an account?", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            CompanionTextButton(text = "Log in", onClick = onLogin, enabled = !state.submitting)
            Spacer(Modifier.weight(1f))
        }
        Spacer(Modifier.height(24.dp))
    }
}
