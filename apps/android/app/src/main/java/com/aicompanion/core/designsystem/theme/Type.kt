package com.aicompanion.core.designsystem.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val Jakarta = FontFamily.SansSerif
private val Fraunces = FontFamily.Serif

private fun display(size: Int, line: Int, tracking: Double) = TextStyle(
    fontFamily = Fraunces,
    fontWeight = FontWeight.Light,
    fontSize = size.sp,
    lineHeight = line.sp,
    letterSpacing = tracking.sp,
)

private fun sans(size: Int, line: Int, weight: FontWeight, tracking: Double) = TextStyle(
    fontFamily = Jakarta,
    fontWeight = weight,
    fontSize = size.sp,
    lineHeight = line.sp,
    letterSpacing = tracking.sp,
)

val CompanionTypography = Typography(
    displayLarge = display(40, 48, -0.5),
    displayMedium = display(32, 40, -0.25),
    displaySmall = display(28, 36, 0.0),
    headlineLarge = sans(28, 36, FontWeight.SemiBold, -0.25),
    headlineMedium = sans(24, 32, FontWeight.SemiBold, -0.15),
    headlineSmall = sans(20, 28, FontWeight.SemiBold, -0.1),
    titleLarge = sans(20, 28, FontWeight.SemiBold, -0.1),
    titleMedium = sans(16, 24, FontWeight.SemiBold, 0.1),
    titleSmall = sans(14, 20, FontWeight.SemiBold, 0.1),
    bodyLarge = sans(16, 24, FontWeight.Normal, 0.15),
    bodyMedium = sans(14, 20, FontWeight.Normal, 0.2),
    bodySmall = sans(12, 16, FontWeight.Normal, 0.3),
    labelLarge = sans(15, 20, FontWeight.SemiBold, 0.1),
    labelMedium = sans(13, 16, FontWeight.SemiBold, 0.3),
    labelSmall = sans(11, 16, FontWeight.Medium, 0.4),
)
