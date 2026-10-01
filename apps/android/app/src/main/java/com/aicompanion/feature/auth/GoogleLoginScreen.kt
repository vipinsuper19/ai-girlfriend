package com.aicompanion.feature.auth

import androidx.activity.compose.BackHandler
import androidx.activity.compose.LocalActivity
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.aicompanion.R
import com.aicompanion.core.designsystem.components.BannerTone
import com.aicompanion.core.designsystem.components.CompanionOutlinedButton
import com.aicompanion.core.designsystem.components.CompanionTextButton
import com.aicompanion.core.designsystem.components.StatusBanner

@Composable
fun GoogleLoginRoute(
    onBack: () -> Unit,
    onEmail: (String) -> Unit,
    onSignup: () -> Unit,
    onAuthenticated: (home: Boolean) -> Unit,
    viewModel: GoogleLoginViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val activity = LocalActivity.current
    LaunchedEffect(Unit) {
        viewModel.navEvents.collect { event ->
            when (event) {
                AuthNavEvent.Home -> onAuthenticated(true)
                AuthNavEvent.Onboarding -> onAuthenticated(false)
                is AuthNavEvent.EmailLogin -> onEmail(event.email)
                AuthNavEvent.Signup -> onSignup()
                else -> Unit
            }
        }
    }
    BackHandler(enabled = state.submitting) { }
    GoogleLoginScreen(
        state = state,
        onBack = onBack,
        onGoogle = { activity?.let(viewModel::continueWithGoogle) },
        onEmail = viewModel::onSignInWithEmail,
        onSignup = viewModel::onCreateAccount,
    )
}

@Composable
fun GoogleLoginScreen(
    state: GoogleLoginState,
    onBack: () -> Unit,
    onGoogle: () -> Unit,
    onEmail: () -> Unit,
    onSignup: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
            .padding(horizontal = 20.dp),
    ) {
        IconButton(onClick = onBack, enabled = !state.submitting) {
            Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
        }
        Spacer(Modifier.weight(1f))
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "L",
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                    style = MaterialTheme.typography.displaySmall,
                )
            }
            Spacer(Modifier.height(18.dp))
            Text("Welcome back", style = MaterialTheme.typography.headlineMedium)
            Spacer(Modifier.height(8.dp))
            Text(
                text = "Continue with Google. It is the fastest way in — and it creates an account if you are new.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
                textAlign = TextAlign.Center,
            )
        }
        Spacer(Modifier.height(28.dp))
        if (state.banner != null) {
            StatusBanner(
                text = state.banner,
                tone = if (state.warning) BannerTone.Warning else BannerTone.Error,
                actionLabel = if (state.warning) "Sign in with email" else "Try Google again",
                onAction = if (state.warning) onEmail else onGoogle,
            )
            Spacer(Modifier.height(16.dp))
        }
        CompanionOutlinedButton(
            text = "Continue with Google",
            onClick = onGoogle,
            enabled = state.available && !state.submitting,
            loading = state.submitting,
            leading = {
                Image(
                    painter = painterResource(R.drawable.ic_google),
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                )
            },
        )
        CompanionTextButton(
            text = "Sign in with email",
            onClick = onEmail,
            enabled = !state.submitting,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.weight(1f))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Spacer(Modifier.weight(1f))
            Text("New here?", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            CompanionTextButton(text = "Create an account", onClick = onSignup, enabled = !state.submitting)
            Spacer(Modifier.weight(1f))
        }
    }
}
