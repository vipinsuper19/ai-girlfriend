package com.dhama.mybase.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

@Immutable
data class CompanionColors(
    val success: Color,
    val successContainer: Color,
    val onSuccessContainer: Color,
    val warning: Color,
    val warningContainer: Color,
    val onWarningContainer: Color,
    val bubbleOutgoing: Color,
    val onBubbleOutgoing: Color,
    val bubbleIncoming: Color,
    val onBubbleIncoming: Color,
    val onlineIndicator: Color,
)

private val LightCompanionColors = CompanionColors(
    success = SuccessLight,
    successContainer = SuccessContainerLight,
    onSuccessContainer = OnSuccessContainerLight,
    warning = WarningLight,
    warningContainer = WarningContainerLight,
    onWarningContainer = OnWarningContainerLight,
    bubbleOutgoing = Mulberry40,
    onBubbleOutgoing = Color.White,
    bubbleIncoming = N94,
    onBubbleIncoming = N10,
    onlineIndicator = SuccessLight,
)

private val DarkCompanionColors = CompanionColors(
    success = SuccessDark,
    successContainer = SuccessContainerDark,
    onSuccessContainer = OnSuccessContainerDark,
    warning = WarningDark,
    warningContainer = WarningContainerDark,
    onWarningContainer = OnWarningContainerDark,
    bubbleOutgoing = Mulberry30,
    onBubbleOutgoing = Mulberry90,
    bubbleIncoming = N17,
    onBubbleIncoming = N90,
    onlineIndicator = SuccessDark,
)

val LocalCompanionColors = staticCompositionLocalOf { LightCompanionColors }

private val LightScheme = lightColorScheme(
    primary = Mulberry40,
    onPrimary = Color.White,
    primaryContainer = Mulberry90,
    onPrimaryContainer = Mulberry10,
    inversePrimary = Mulberry80,
    secondary = Champagne40,
    onSecondary = Color.White,
    secondaryContainer = Champagne90,
    onSecondaryContainer = Champagne10,
    tertiary = Dusk40,
    onTertiary = Color.White,
    tertiaryContainer = Dusk90,
    onTertiaryContainer = Dusk10,
    background = N98,
    onBackground = N10,
    surface = N98,
    onSurface = N10,
    surfaceVariant = NV90,
    onSurfaceVariant = NV30,
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = N96,
    surfaceContainer = N94,
    surfaceContainerHigh = NHighLight,
    surfaceContainerHighest = N90,
    outline = NV50,
    outlineVariant = NV80,
    inverseSurface = N20,
    inverseOnSurface = N95,
    error = ErrorLight,
    onError = Color.White,
    errorContainer = ErrorContainerLight,
    onErrorContainer = OnErrorContainerLight,
    scrim = Color.Black,
)

private val DarkScheme = darkColorScheme(
    primary = Mulberry80,
    onPrimary = Mulberry20,
    primaryContainer = Mulberry30,
    onPrimaryContainer = Mulberry90,
    inversePrimary = Mulberry40,
    secondary = Champagne80,
    onSecondary = Champagne20,
    secondaryContainer = Champagne30,
    onSecondaryContainer = Champagne90,
    tertiary = Dusk80,
    onTertiary = Dusk20,
    tertiaryContainer = Dusk30,
    onTertiaryContainer = Dusk90,
    background = N6,
    onBackground = N90,
    surface = N6,
    onSurface = N90,
    surfaceVariant = NV30,
    onSurfaceVariant = NV80,
    surfaceContainerLowest = NLowestDark,
    surfaceContainerLow = N10,
    surfaceContainer = N12,
    surfaceContainerHigh = N17,
    surfaceContainerHighest = N22,
    outline = NV60,
    outlineVariant = NV30,
    inverseSurface = N90,
    inverseOnSurface = N20,
    error = ErrorDark,
    onError = OnErrorDark,
    errorContainer = ErrorContainerDark,
    onErrorContainer = ErrorContainerLight,
    scrim = Color.Black,
)

@Composable
fun MyBaseTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false, // Deliberately ignored as specified in docs section 2.4
    content: @Composable () -> Unit,
) {
    val scheme = if (darkTheme) DarkScheme else LightScheme
    val extended = if (darkTheme) DarkCompanionColors else LightCompanionColors

    CompositionLocalProvider(LocalCompanionColors provides extended) {
        MaterialTheme(
            colorScheme = scheme,
            typography = AppTypography,
            content = content,
        )
    }
}

val MaterialTheme.companionColors: CompanionColors
    @Composable @ReadOnlyComposable get() = LocalCompanionColors.current
