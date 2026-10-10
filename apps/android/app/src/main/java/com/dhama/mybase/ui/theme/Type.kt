package com.dhama.mybase.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.googlefonts.Font
import androidx.compose.ui.text.googlefonts.GoogleFont
import androidx.compose.ui.unit.sp
import com.dhama.mybase.R

private val provider = GoogleFont.Provider(
    providerAuthority = "com.google.android.gms.fonts",
    providerPackage = "com.google.android.gms",
    certificates = R.array.com_google_android_gms_fonts_certs
)

// Plus Jakarta Sans for UI elements
private val JakartaFontFamily = FontFamily(
    Font(googleFont = GoogleFont("Plus Jakarta Sans"), fontProvider = provider, weight = FontWeight.Normal),
    Font(googleFont = GoogleFont("Plus Jakarta Sans"), fontProvider = provider, weight = FontWeight.Medium),
    Font(googleFont = GoogleFont("Plus Jakarta Sans"), fontProvider = provider, weight = FontWeight.SemiBold),
    Font(googleFont = GoogleFont("Plus Jakarta Sans"), fontProvider = provider, weight = FontWeight.Bold)
)

// Fraunces Light for specific premium title displays
private val FrauncesFontFamily = FontFamily(
    Font(googleFont = GoogleFont("Fraunces"), fontProvider = provider, weight = FontWeight.Light)
)

private fun displayStyle(size: Int, line: Int, tracking: Double) = TextStyle(
    fontFamily = FrauncesFontFamily,
    fontWeight = FontWeight.Light,
    fontSize = size.sp,
    lineHeight = line.sp,
    letterSpacing = tracking.sp
)

private fun sansStyle(size: Int, line: Int, weight: FontWeight, tracking: Double) = TextStyle(
    fontFamily = JakartaFontFamily,
    fontWeight = weight,
    fontSize = size.sp,
    lineHeight = line.sp,
    letterSpacing = tracking.sp
)

val AppTypography = Typography(
    displayLarge  = displayStyle(40, 48, -0.5),
    displayMedium = displayStyle(32, 40, -0.25),
    displaySmall  = displayStyle(28, 36, 0.0),

    headlineLarge  = sansStyle(28, 36, FontWeight.SemiBold, -0.25),
    headlineMedium = sansStyle(24, 32, FontWeight.SemiBold, -0.15),
    headlineSmall  = sansStyle(20, 28, FontWeight.SemiBold, -0.1),

    titleLarge  = sansStyle(20, 28, FontWeight.SemiBold, -0.1),
    titleMedium = sansStyle(16, 24, FontWeight.SemiBold, 0.1),
    titleSmall  = sansStyle(14, 20, FontWeight.SemiBold, 0.1),

    bodyLarge  = sansStyle(16, 24, FontWeight.Normal, 0.15),
    bodyMedium = sansStyle(14, 20, FontWeight.Normal, 0.2),
    bodySmall  = sansStyle(12, 16, FontWeight.Normal, 0.3),

    labelLarge  = sansStyle(15, 20, FontWeight.SemiBold, 0.1),
    labelMedium = sansStyle(13, 16, FontWeight.SemiBold, 0.3),
    labelSmall  = sansStyle(11, 16, FontWeight.Medium, 0.4)
)
