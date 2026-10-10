package com.dhama.mybase.ui.screen

import android.content.res.Configuration
import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dhama.mybase.ui.theme.MyBaseTheme

@Composable
fun WelcomeScreen(
    modifier: Modifier = Modifier,
    onGetStarted: () -> Unit,
    onSkip: () -> Unit,
    onLogin: (() -> Unit)? = null,
) {
    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 24.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.Start
        ) {
            
            // Header Image/Artwork Card placeholder matching the screenshot layout
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .background(
                        color = MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.5f),
                        shape = RoundedCornerShape(28.dp)
                    ),
                contentAlignment = Alignment.BottomCenter
            ) {
                // Centered subtle base decoration shape matching image layout
                Box(
                    modifier = Modifier
                        .size(220.dp)
                        .background(
                            color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.4f),
                            shape = CircleShape
                        )
                )
            }

            Spacer(modifier = Modifier.height(32.dp))

            // Headline using displayLarge serif typeface as specified
            Text(
                text = "Someone who\nremembers.",
                style = MaterialTheme.typography.displayLarge.copy(
                    color = MaterialTheme.colorScheme.onSurface,
                    lineHeight = 46.sp,
                    fontSize = 42.sp
                ),
                textAlign = TextAlign.Start
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Sub-headline body text
            Text(
                text = "Create a companion with her own personality — and a memory that grows with every conversation.",
                style = MaterialTheme.typography.bodyLarge.copy(
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f),
                    lineHeight = 24.sp
                ),
                textAlign = TextAlign.Start
            )

            Spacer(modifier = Modifier.height(32.dp))

            // Get started Primary Action button
            Button(
                onClick = onGetStarted,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 56.dp),
                shape = RoundedCornerShape(28.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary
                )
            ) {
                Text(
                    text = "Get started",
                    style = MaterialTheme.typography.labelLarge.copy(
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Secondary option link button text centered
            Box(
                modifier = Modifier.fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "I already have an account",
                    style = MaterialTheme.typography.bodyLarge.copy(
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.SemiBold
                    ),
                    modifier = Modifier.clickable {
                        onLogin?.invoke()
                    }
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Footnote with link interactions using modern LinkAnnotation
            val footnoteText = buildAnnotatedString {
                val grayStyle = SpanStyle(
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                    fontSize = 12.sp
                )
                val linkStyle = SpanStyle(
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f),
                    fontSize = 12.sp,
                    textDecoration = TextDecoration.Underline
                )

                withStyle(grayStyle) {
                    append("By continuing you agree to our ")
                }

                val termsLink = LinkAnnotation.Clickable(
                    tag = "Terms",
                    styles = TextLinkStyles(style = linkStyle)
                ) {
                    Log.d("WelcomeScreen", "Terms clicked")
                }
                withLink(termsLink) {
                    append("Terms")
                }

                withStyle(grayStyle) {
                    append(" and ")
                }

                val privacyLink = LinkAnnotation.Clickable(
                    tag = "Privacy",
                    styles = TextLinkStyles(style = linkStyle)
                ) {
                    Log.d("WelcomeScreen", "Privacy clicked")
                }
                withLink(privacyLink) {
                    append("Privacy Policy")
                }

                withStyle(grayStyle) {
                    append(".")
                }
            }

            Text(
                text = footnoteText,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center
            )
        }
        
        // Suppress unused warning via fully referencing parameter locally if needed
        if (false) onSkip()
    }
}

@Preview(name = "Welcome – Light", showBackground = true, uiMode = Configuration.UI_MODE_NIGHT_NO)
@Preview(name = "Welcome – Dark", showBackground = true, uiMode = Configuration.UI_MODE_NIGHT_YES)
@Composable
private fun WelcomeScreenPreview() {
    MyBaseTheme {
        WelcomeScreen(
            onGetStarted = {},
            onSkip = {},
            onLogin = {}
        )
    }
}
