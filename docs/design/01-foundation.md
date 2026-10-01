# Design Task 1 — Foundation

Design system, colour, typography, components, navigation for the Android client.

Companion pieces: `docs/design.txt` (the brief), `docs/ANDROID_PLAN.md` (architecture and phasing),
and the visual reference canvas at `canvases/android-design-foundation.canvas.tsx`, which renders
every palette, type specimen, and component preview in this document.

Everything here targets Material 3 with Compose BOM 2026.06.00. Token names are Material 3 slot
names wherever one exists, so translating this document into `Theme.kt` is mechanical rather than
interpretive.

---

## 1. Visual direction

Three rules. They exist to settle arguments quickly and to keep later screens consistent with these
ones without re-litigating taste.

**Warmth without pink.** The brand hue is a deep mulberry — a wine red pulled toward plum — not a hot
pink. Every neutral carries a faint mauve cast so surfaces read warm rather than clinical grey. No
hearts, no blush gradients, no rounded-bubble cuteness. The brief's "avoid excessive pink" is not a
request to desaturate; it is a request to be an adult product.

**The companion is the accent.** Chrome stays neutral. Saturated colour is reserved for three things:
the companion's avatar, her messages, and the single primary action on the screen. If a screen has
colour anywhere else, something is competing with her for attention.

**Restraint reads as premium.** Depth comes from Material 3 tonal surfaces rather than shadows or
glass. One serif face, used in four places. Generous spacing does the work decoration usually does.
Cheap products add; expensive ones subtract.

---

## 2. Colour

### 2.1 Palette structure

Four tonal ramps at Material 3 tone stops. Light theme draws accents from tone 40, dark theme from
tone 80 — the standard M3 relationship, which is what makes the two themes feel like one design
rather than two.

**Mulberry — primary.** Brand, CTAs, outgoing chat bubbles.

| Tone | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 95 |
|---|---|---|---|---|---|---|---|---|---|---|
| Hex | `#3B0B21` | `#571435` | `#752049` | `#932D5E` | `#B14476` | `#C56A92` | `#D791AE` | `#E7B7CA` | `#F5DCE6` | `#FBEDF2` |

**Champagne — secondary.** Premium moments, subscription surfaces, the active navigation indicator.

| Tone | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 95 |
|---|---|---|---|---|---|---|---|---|---|---|
| Hex | `#2A1E05` | `#43330E` | `#5D4A19` | `#786224` | `#957D34` | `#B39A4C` | `#D0B76A` | `#E6D091` | `#F5E9C4` | `#FCF5E3` |

**Dusk Violet — tertiary.** Memory and AI-derived surfaces. Gives the memory feature its own visual
identity without inventing a fourth brand colour.

| Tone | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 95 |
|---|---|---|---|---|---|---|---|---|---|---|
| Hex | `#25103A` | `#3C1E56` | `#542C73` | `#6D3D91` | `#8756AC` | `#A275C2` | `#BC96D6` | `#D6B8E8` | `#EDDCF6` | `#F7EDFB` |

**Warm Neutral — surfaces and text.** Mauve-cast, never pure grey.

| Tone | 6 | 10 | 12 | 17 | 22 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 94 | 98 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Hex | `#141013` | `#1C171A` | `#211B1F` | `#2B2429` | `#362E34` | `#483F45` | `#60565D` | `#7A6F76` | `#95898F` | `#B0A3AA` | `#CCBEC5` | `#E9DAE1` | `#F4E7EC` | `#FEF7F9` |

**Neutral Variant — outlines.** `30 #4C424A` · `50 #7E7280` · `60 #988B99` · `80 #D0C2CE` · `90 #EDDEEA`

#### Why champagne rather than amber for the secondary

The obvious "warm premium accent" is a copper or amber, and it is the wrong choice here: it collides
with the warning colour. Semantic state must never be confusable with brand decoration, or a user
learns to ignore the exact colour you need them to notice. Champagne sits at much lower chroma than
warning amber, so the two stay separable — and because the design never communicates state by colour
alone (§7), a user who cannot distinguish the hues at all still gets the message from the icon.

### 2.2 Semantic role mapping

Light theme:

| Role | Hex | Role | Hex |
|---|---|---|---|
| `primary` | `#932D5E` | `onPrimary` | `#FFFFFF` |
| `primaryContainer` | `#F5DCE6` | `onPrimaryContainer` | `#3B0B21` |
| `secondary` | `#786224` | `onSecondary` | `#FFFFFF` |
| `secondaryContainer` | `#F5E9C4` | `onSecondaryContainer` | `#2A1E05` |
| `tertiary` | `#6D3D91` | `onTertiary` | `#FFFFFF` |
| `tertiaryContainer` | `#EDDCF6` | `onTertiaryContainer` | `#25103A` |
| `background` / `surface` | `#FEF7F9` | `onSurface` | `#1C171A` |
| `surfaceContainerLowest` | `#FFFFFF` | `surfaceContainerLow` | `#FAEDF2` |
| `surfaceContainer` | `#F4E7EC` | `surfaceContainerHigh` | `#EFE1E7` |
| `surfaceContainerHighest` | `#E9DAE1` | `surfaceVariant` | `#EDDEEA` |
| `onSurfaceVariant` | `#4C424A` | `outline` | `#7E7280` |
| `outlineVariant` | `#D0C2CE` | `inversePrimary` | `#E7B7CA` |
| `inverseSurface` | `#312A2F` | `inverseOnSurface` | `#F7EAEF` |
| `error` | `#B3261E` | `onError` | `#FFFFFF` |
| `errorContainer` | `#F9DEDC` | `onErrorContainer` | `#410E0B` |

Dark theme:

| Role | Hex | Role | Hex |
|---|---|---|---|
| `primary` | `#E7B7CA` | `onPrimary` | `#571435` |
| `primaryContainer` | `#752049` | `onPrimaryContainer` | `#F5DCE6` |
| `secondary` | `#E6D091` | `onSecondary` | `#43330E` |
| `secondaryContainer` | `#5D4A19` | `onSecondaryContainer` | `#F5E9C4` |
| `tertiary` | `#D6B8E8` | `onTertiary` | `#3C1E56` |
| `tertiaryContainer` | `#542C73` | `onTertiaryContainer` | `#EDDCF6` |
| `background` / `surface` | `#141013` | `onSurface` | `#E9DAE1` |
| `surfaceContainerLowest` | `#0E0B0D` | `surfaceContainerLow` | `#1C171A` |
| `surfaceContainer` | `#211B1F` | `surfaceContainerHigh` | `#2B2429` |
| `surfaceContainerHighest` | `#362E34` | `surfaceVariant` | `#4C424A` |
| `onSurfaceVariant` | `#D0C2CE` | `outline` | `#988B99` |
| `outlineVariant` | `#4C424A` | `inversePrimary` | `#932D5E` |
| `inverseSurface` | `#E9DAE1` | `inverseOnSurface` | `#312A2F` |
| `error` | `#F2B8B5` | `onError` | `#601410` |
| `errorContainer` | `#8C1D18` | `onErrorContainer` | `#F9DEDC` |

### 2.3 Extension colours

Material 3 has no slot for success, warning, or chat bubbles, so these ride in a
`CompanionColors` class exposed through a `CompositionLocal` (code in §2.5).

| Token | Light | Dark |
|---|---|---|
| `success` | `#2E6B4F` | `#96D8B4` |
| `successContainer` | `#CBEBD9` | `#1E4F35` |
| `onSuccessContainer` | `#0B2418` | `#B9E9CE` |
| `warning` | `#8A5300` | `#FFB865` |
| `warningContainer` | `#FFDDB3` | `#6A3F00` |
| `onWarningContainer` | `#2C1700` | `#FFDDB3` |
| `bubbleOutgoing` | `#932D5E` | `#752049` |
| `onBubbleOutgoing` | `#FFFFFF` | `#F5DCE6` |
| `bubbleIncoming` | `#F4E7EC` | `#2B2429` |
| `onBubbleIncoming` | `#1C171A` | `#E9DAE1` |
| `onlineIndicator` | `#2E6B4F` | `#96D8B4` |

### 2.4 Contrast verification

WCAG 2.1 ratios for every foreground/background pair the app actually renders. Body text needs 4.5:1
for AA and 7:1 for AAA.

| Pair | Light | Dark |
|---|---|---|
| `onSurface` on `surface` | 17.0:1 | 14.0:1 |
| `onSurfaceVariant` on `surface` | 9.1:1 | 11.1:1 |
| `onPrimary` on `primary` | 7.5:1 | 7.8:1 |
| `onBubbleOutgoing` on `bubbleOutgoing` | 7.5:1 | 7.9:1 |
| `onBubbleIncoming` on `bubbleIncoming` | 15.0:1 | 11.3:1 |
| `secondary` on `surface` | 6.0:1 | 12.4:1 |
| `tertiary` on `surface` | 7.7:1 | 10.7:1 |
| `error` on `surface` | 6.5:1 | 11.1:1 |
| `success` on `surface` | 6.4:1 | 11.5:1 |
| `warning` on `surface` | 6.3:1 | 11.1:1 |
| `onPrimaryContainer` on `primaryContainer` | 12.9:1 | 7.9:1 |

Everything clears AA; all but `secondary`, `error`, `success`, and `warning` in light theme clear
AAA, and those four are used for short labels and icons rather than sustained reading. Any future
token change must be re-checked against this table — it is the reason the palette can be trusted
rather than merely liked.

**Dynamic colour is off.** A companion whose colour shifts with the user's wallpaper stops feeling
like a specific person. Do not call `dynamicLightColorScheme` / `dynamicDarkColorScheme`.

### 2.5 `Color.kt` and `Theme.kt`

```kotlin
// core/designsystem/src/main/kotlin/.../theme/Color.kt
package com.aicompanion.core.designsystem.theme

import androidx.compose.ui.graphics.Color

// Mulberry
val Mulberry10 = Color(0xFF3B0B21); val Mulberry20 = Color(0xFF571435)
val Mulberry30 = Color(0xFF752049); val Mulberry40 = Color(0xFF932D5E)
val Mulberry80 = Color(0xFFE7B7CA); val Mulberry90 = Color(0xFFF5DCE6)

// Champagne
val Champagne10 = Color(0xFF2A1E05); val Champagne20 = Color(0xFF43330E)
val Champagne30 = Color(0xFF5D4A19); val Champagne40 = Color(0xFF786224)
val Champagne80 = Color(0xFFE6D091); val Champagne90 = Color(0xFFF5E9C4)

// Dusk Violet
val Dusk10 = Color(0xFF25103A); val Dusk20 = Color(0xFF3C1E56)
val Dusk30 = Color(0xFF542C73); val Dusk40 = Color(0xFF6D3D91)
val Dusk80 = Color(0xFFD6B8E8); val Dusk90 = Color(0xFFEDDCF6)

// Warm neutral
val N6  = Color(0xFF141013); val N10 = Color(0xFF1C171A); val N12 = Color(0xFF211B1F)
val N17 = Color(0xFF2B2429); val N20 = Color(0xFF312A2F); val N22 = Color(0xFF362E34)
val N90 = Color(0xFFE9DAE1); val N94 = Color(0xFFF4E7EC); val N95 = Color(0xFFF7EAEF)
val N96 = Color(0xFFFAEDF2); val N98 = Color(0xFFFEF7F9)
val NLowestDark = Color(0xFF0E0B0D); val NHighLight = Color(0xFFEFE1E7)

// Neutral variant
val NV30 = Color(0xFF4C424A); val NV50 = Color(0xFF7E7280)
val NV60 = Color(0xFF988B99); val NV80 = Color(0xFFD0C2CE); val NV90 = Color(0xFFEDDEEA)

// Semantic
val ErrorLight = Color(0xFFB3261E); val ErrorContainerLight = Color(0xFFF9DEDC)
val OnErrorContainerLight = Color(0xFF410E0B)
val ErrorDark = Color(0xFFF2B8B5); val OnErrorDark = Color(0xFF601410)
val ErrorContainerDark = Color(0xFF8C1D18)

val SuccessLight = Color(0xFF2E6B4F); val SuccessContainerLight = Color(0xFFCBEBD9)
val OnSuccessContainerLight = Color(0xFF0B2418)
val SuccessDark = Color(0xFF96D8B4); val SuccessContainerDark = Color(0xFF1E4F35)
val OnSuccessContainerDark = Color(0xFFB9E9CE)

val WarningLight = Color(0xFF8A5300); val WarningContainerLight = Color(0xFFFFDDB3)
val OnWarningContainerLight = Color(0xFF2C1700)
val WarningDark = Color(0xFFFFB865); val WarningContainerDark = Color(0xFF6A3F00)
val OnWarningContainerDark = Color(0xFFFFDDB3)
```

```kotlin
// core/designsystem/src/main/kotlin/.../theme/Theme.kt
package com.aicompanion.core.designsystem.theme

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
    primary = Mulberry40, onPrimary = Color.White,
    primaryContainer = Mulberry90, onPrimaryContainer = Mulberry10,
    inversePrimary = Mulberry80,
    secondary = Champagne40, onSecondary = Color.White,
    secondaryContainer = Champagne90, onSecondaryContainer = Champagne10,
    tertiary = Dusk40, onTertiary = Color.White,
    tertiaryContainer = Dusk90, onTertiaryContainer = Dusk10,
    background = N98, onBackground = N10,
    surface = N98, onSurface = N10,
    surfaceVariant = NV90, onSurfaceVariant = NV30,
    surfaceContainerLowest = Color.White, surfaceContainerLow = N96,
    surfaceContainer = N94, surfaceContainerHigh = NHighLight,
    surfaceContainerHighest = N90,
    outline = NV50, outlineVariant = NV80,
    inverseSurface = N20, inverseOnSurface = N95,
    error = ErrorLight, onError = Color.White,
    errorContainer = ErrorContainerLight, onErrorContainer = OnErrorContainerLight,
    scrim = Color.Black,
)

private val DarkScheme = darkColorScheme(
    primary = Mulberry80, onPrimary = Mulberry20,
    primaryContainer = Mulberry30, onPrimaryContainer = Mulberry90,
    inversePrimary = Mulberry40,
    secondary = Champagne80, onSecondary = Champagne20,
    secondaryContainer = Champagne30, onSecondaryContainer = Champagne90,
    tertiary = Dusk80, onTertiary = Dusk20,
    tertiaryContainer = Dusk30, onTertiaryContainer = Dusk90,
    background = N6, onBackground = N90,
    surface = N6, onSurface = N90,
    surfaceVariant = NV30, onSurfaceVariant = NV80,
    surfaceContainerLowest = NLowestDark, surfaceContainerLow = N10,
    surfaceContainer = N12, surfaceContainerHigh = N17,
    surfaceContainerHighest = N22,
    outline = NV60, outlineVariant = NV30,
    inverseSurface = N90, inverseOnSurface = N20,
    error = ErrorDark, onError = OnErrorDark,
    errorContainer = ErrorContainerDark, onErrorContainer = ErrorContainerLight,
    scrim = Color.Black,
)

@Composable
fun CompanionTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    // Deliberately no dynamic colour — see docs/design/01-foundation.md §2.4.
    val scheme = if (darkTheme) DarkScheme else LightScheme
    val extended = if (darkTheme) DarkCompanionColors else LightCompanionColors

    CompositionLocalProvider(LocalCompanionColors provides extended) {
        MaterialTheme(
            colorScheme = scheme,
            typography = CompanionTypography,
            shapes = CompanionShapes,
            content = content,
        )
    }
}

/** `MaterialTheme.companionColors` alongside `MaterialTheme.colorScheme`. */
val MaterialTheme.companionColors: CompanionColors
    @Composable @ReadOnlyComposable get() = LocalCompanionColors.current
```

---

## 3. Typography

### 3.1 Faces

**Plus Jakarta Sans** for all UI. Geometric humanist — modern without the coldness of a pure
grotesque, and it has a genuinely good 600 weight, which matters because most of the hierarchy here
is carried by weight rather than size.

**Fraunces Light** for display, in exactly four places: the splash brand mark, the Welcome headline,
the companion's name on the Home hero, and the "Meet Your Companion" finale. A serif in those four
moments is what stops the product reading as another chat app. Using it anywhere else dilutes that
to zero.

Ship Fraunces as a **single static instance** (Light 300, Latin subset, roughly 40KB). The variable
font is over 200KB and none of its axes are needed for four static strings.

### 3.2 Scale

| M3 slot | Face | Size/Line | Weight | Tracking | Used for |
|---|---|---|---|---|---|
| `displayLarge` | Fraunces | 40/48 | 300 | -0.5 | Splash and Welcome brand headline |
| `displayMedium` | Fraunces | 32/40 | 300 | -0.25 | Companion name, Home hero |
| `displaySmall` | Fraunces | 28/36 | 300 | 0 | Onboarding step headline |
| `headlineLarge` | Jakarta | 28/36 | 600 | -0.25 | Rare — empty-state headline |
| `headlineMedium` | Jakarta | 24/32 | 600 | -0.15 | Screen title |
| `headlineSmall` | Jakarta | 20/28 | 600 | -0.1 | Section heading |
| `titleLarge` | Jakarta | 20/28 | 600 | -0.1 | App bar title |
| `titleMedium` | Jakarta | 16/24 | 600 | 0.1 | List row title, card title |
| `titleSmall` | Jakarta | 14/20 | 600 | 0.1 | Overline, group label |
| `bodyLarge` | Jakarta | 16/24 | 400 | 0.15 | Chat messages, primary body |
| `bodyMedium` | Jakarta | 14/20 | 400 | 0.2 | Secondary body, list subtitle |
| `bodySmall` | Jakarta | 12/16 | 400 | 0.3 | Caption, timestamp, helper text |
| `labelLarge` | Jakarta | 15/20 | 600 | 0.1 | Button text |
| `labelMedium` | Jakarta | 13/16 | 600 | 0.3 | Chip text, nav label |
| `labelSmall` | Jakarta | 11/16 | 500 | 0.4 | Badge, smallest label |

Chat messages use `bodyLarge` at 16sp. Do not shrink it: message text is the single thing users read
most in this product, and 14sp chat is the most common way companion apps feel cheap.

### 3.3 `Type.kt`

```kotlin
package com.aicompanion.core.designsystem.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.aicompanion.core.designsystem.R

private val Jakarta = FontFamily(
    Font(R.font.plus_jakarta_sans_regular, FontWeight.Normal),
    Font(R.font.plus_jakarta_sans_medium, FontWeight.Medium),
    Font(R.font.plus_jakarta_sans_semibold, FontWeight.SemiBold),
)

/** Display only — four call sites. See §3.1. */
private val Fraunces = FontFamily(Font(R.font.fraunces_light, FontWeight.Light))

private fun display(size: Int, line: Int, tracking: Double) = TextStyle(
    fontFamily = Fraunces, fontWeight = FontWeight.Light,
    fontSize = size.sp, lineHeight = line.sp, letterSpacing = tracking.sp,
)

private fun sans(size: Int, line: Int, weight: FontWeight, tracking: Double) = TextStyle(
    fontFamily = Jakarta, fontWeight = weight,
    fontSize = size.sp, lineHeight = line.sp, letterSpacing = tracking.sp,
)

val CompanionTypography = Typography(
    displayLarge  = display(40, 48, -0.5),
    displayMedium = display(32, 40, -0.25),
    displaySmall  = display(28, 36, 0.0),

    headlineLarge  = sans(28, 36, FontWeight.SemiBold, -0.25),
    headlineMedium = sans(24, 32, FontWeight.SemiBold, -0.15),
    headlineSmall  = sans(20, 28, FontWeight.SemiBold, -0.1),

    titleLarge  = sans(20, 28, FontWeight.SemiBold, -0.1),
    titleMedium = sans(16, 24, FontWeight.SemiBold, 0.1),
    titleSmall  = sans(14, 20, FontWeight.SemiBold, 0.1),

    bodyLarge  = sans(16, 24, FontWeight.Normal, 0.15),
    bodyMedium = sans(14, 20, FontWeight.Normal, 0.2),
    bodySmall  = sans(12, 16, FontWeight.Normal, 0.3),

    labelLarge  = sans(15, 20, FontWeight.SemiBold, 0.1),
    labelMedium = sans(13, 16, FontWeight.SemiBold, 0.3),
    labelSmall  = sans(11, 16, FontWeight.Medium, 0.4),
)
```

### 3.4 Dynamic type

All sizes are `sp` and scale with the user's font-size setting. Android 14+ applies non-linear
scaling up to 200%, which breaks any layout that assumes a text block's height.

Rules: never set a fixed `height` on a container whose only content is text — use `heightIn(min = …)`
instead. Never use `maxLines = 1` on anything a user typed unless it is genuinely a single-line field.
Test every screen at 200% font scale plus the largest display size; that combination is where layouts
actually fail, and it is a supported configuration, not an edge case.

---

## 4. Spacing, shape, elevation, motion

**Spacing** is a 4dp grid: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.

The screen gutter is **20dp**, not the Material default 16dp. At 360dp width that extra 4dp per side
is most of what separates "premium" from "dense", and it is the cheapest possible way to buy the
feeling the brief asks for. List rows keep 16dp internal padding so they do not float.

**Radius:** `xs` 8dp (chips, tags) · `sm` 12dp (small surfaces) · `md` 16dp (text fields) ·
`lg` 20dp (cards, bubbles) · `xl` 28dp (bottom sheets, buttons) · `full` (avatars, FAB).

Chat bubbles are 20dp on three corners and 6dp on the tail corner — the corner nearest the sender.

```kotlin
val CompanionShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small      = RoundedCornerShape(12.dp),
    medium     = RoundedCornerShape(16.dp),
    large      = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(28.dp),
)
```

**Elevation** is tonal, not shadowed. Level 0 is `surface`, level 1 `surfaceContainerLow` (cards at
rest), level 2 `surfaceContainer` (app bar once scrolled), level 3 `surfaceContainerHigh` (bottom
sheets, dialogs, the composer). Dark mode uses **no shadows at all** — they are invisible against a
near-black background and only cost overdraw. Light mode casts a real shadow in exactly two places:
the FAB and the floating composer.

**Motion:** instant 100ms, quick 200ms, standard 300ms, emphasized 400ms. Easing is M3 standard,
`CubicBezierEasing(0.2f, 0f, 0f, 1f)`. Every duration must collapse to zero when the system animator
duration scale is 0 — read `Settings.Global.ANIMATOR_DURATION_SCALE` once and expose it through a
`LocalReduceMotion` composition local. Users who turn animations off usually have a reason.

---

## 5. Component library

Twenty-eight components. Each lives in `core/designsystem` and takes a `Modifier` as its first
optional parameter, per Compose API guidelines. Nothing here reads from a ViewModel — these are
stateless and driven entirely by parameters, so they can be previewed and screenshot-tested in
isolation.

Universal rules: minimum touch target 48dp (`Modifier.minimumInteractiveComponentSize()` when the
visual is smaller), disabled opacity 0.38, and every icon-only control carries a
`contentDescription`.

### Buttons

**`PrimaryButton`** — 56dp tall, pill radius, `primary` fill. One per screen. States: enabled,
pressed (M3 ripple), disabled (0.38), loading (a 20dp `CircularProgressIndicator` replaces the label
while the button keeps its width, so the layout does not jump).

```kotlin
@Composable fun PrimaryButton(
    text: String, onClick: () -> Unit, modifier: Modifier = Modifier,
    enabled: Boolean = true, loading: Boolean = false, leadingIcon: ImageVector? = null,
)
```

**`SecondaryButton`** — same metrics, `primaryContainer` fill. For the second-most-likely action.

**`OutlinedButton`** — transparent with a 1dp `outline` stroke. Dismissive actions: "Skip for now".

**`GoogleButton`** — same 56dp pill metrics as `PrimaryButton`, outlined, `onSurface` label, official
four-colour G at 18dp leading. Label is "Continue with Google". Loading replaces the G with a spinner
and the label with "Connecting…". Used on Google sign-in and Signup only. Do not render it on Email
sign-in. Omit the composable entirely when Play Services / Credential Manager is unavailable — do
not render it disabled.

```kotlin
@Composable fun GoogleButton(
    onClick: () -> Unit, modifier: Modifier = Modifier,
    enabled: Boolean = true, loading: Boolean = false,
)
```

**`TextButton`** — no container, 40dp tall, 12dp horizontal padding. Inline navigation: "Forgot
password?". Never the only way to complete a task.

### Inputs

**`CompanionTextField`** — 56dp minimum, 16dp radius, `surfaceContainerLow` fill, 1dp
`outlineVariant` at rest widening to 2dp `primary` on focus and 2dp `error` on error. A persistent
helper-text slot below reserves its own height so validation errors do not shift the form. States:
rest, focused, filled, error, disabled, read-only.

```kotlin
@Composable fun CompanionTextField(
    value: String, onValueChange: (String) -> Unit, label: String,
    modifier: Modifier = Modifier, helperText: String? = null, errorText: String? = null,
    enabled: Boolean = true, singleLine: Boolean = true,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    leadingIcon: ImageVector? = null, trailingSlot: @Composable (() -> Unit)? = null,
)
```

**`PasswordField`** — wraps the above with a visibility toggle whose `contentDescription` flips
between "Show password" and "Hide password", plus an optional strength meter (a 4dp bar using
`error` / `warning` / `success`) that appears only on signup.

**`SearchField`** — pill radius, `surfaceContainer` fill, leading search icon, trailing clear button
once non-empty. Used in Memory.

**`OtpInput`** — six 48×56dp cells, auto-advance, paste support, whole-group error state. Built now
because password reset may need it; not wired until the backend supports it.

### Navigation

**`CompanionTopBar`** — `TopAppBar` at `surface`, becoming `surfaceContainer` once the content
scrolls. Variants: title-only, back + title, and a `chat` variant carrying a 36dp avatar, the
companion's name, and a presence line.

**`CompanionBottomBar`** — `NavigationBar` at `surfaceContainer`. Active item shows a
`secondaryContainer` pill behind the icon with a filled icon variant and a 600-weight label; inactive
uses outline icons and `onSurfaceVariant`. Four items (see §6).

**`CompanionTabRow`** — text tabs with a 3dp `primary` indicator. Used inside Memory for category
filtering when the chip row is too long.

### Surfaces

**`CompanionCard`** — 20dp radius, `surfaceContainerLow`, 16dp padding, optional click with ripple.

**`SectionCard`** — a grouped-settings container: 20dp radius, rows separated by `outlineVariant`
dividers inset 16dp from the leading edge.

**`ImageCard`** — 1:1 or 3:4 `AsyncImage` via Coil with a `surfaceContainerHigh` placeholder, an
optional favourite toggle top-right, and a 12dp radius. For the gallery, once the backend supports
it.

**`SubscriptionCard`** — plan name, price, feature list, CTA. The current plan takes a 2dp
`secondary` border and a `secondaryContainer` "CURRENT" badge; the recommended upgrade takes a
`primary` fill on its CTA. Includes an inline usage meter.

### Identity

**`Avatar`** — circular Coil image in 24 / 36 / 48 / 64dp. Falls back to the initial on
`primaryContainer` in `displaySmall`. Optional presence dot: 12dp, `onlineIndicator`, with a 2dp
`surface` ring so it reads against any background.

**`CompanionAvatar`** — the hero variant, 96–160dp, with an optional 2dp `primaryContainer` ring and
a subtle breathing scale animation (1.0 → 1.015 over 4s) that conveys presence without gimmickry.
The animation respects reduce-motion.

### Chat

**`ChatBubble`** — max width 78% of the viewport, 20dp radius with a 6dp tail corner, 12dp vertical
and 16dp horizontal padding, `bodyLarge`. Outgoing uses `bubbleOutgoing`; incoming uses
`bubbleIncoming`. Timestamps are `bodySmall` at 70% opacity and appear only when more than five
minutes separate two messages — per-message timestamps are visual noise in a fast exchange.

States: sending (0.55 alpha), sent, failed (error icon plus a "Retry" text button beneath, and the
retry must be reachable by a screen reader as a real button, not a tap target on the bubble),
streaming (text grows in place with a caret), long (no truncation — chat text is never collapsed),
image, and audio.

```kotlin
@Composable fun ChatBubble(
    message: UiMessage, modifier: Modifier = Modifier,
    onRetry: (() -> Unit)? = null, onLongPress: (() -> Unit)? = null,
)
```

**`TypingIndicator`** — three 7dp dots in an incoming-shaped bubble, staggered 0.6s opacity cycle.
Announces "Aria is typing" to TalkBack once, not on every frame.

**`MessageComposer`** — 28dp radius, `surfaceContainerHigh`, expanding from one line to a maximum of
five, then scrolling internally. A 42dp circular send button fills with `primary` only when the input
is non-empty. Also holds the mic entry point and an attachment action. Sits above the IME with
`imePadding()` and above the nav bar with `navigationBarsPadding()`.

**`AudioMessageBubble`** — play/pause, a waveform or progress bar, and elapsed time. Backed by Media3.

### Selection and feedback

**`CompanionChip`** — 8dp radius, 36dp tall. Unselected is an `outlineVariant` outline; selected is
`secondaryContainer` fill with a leading check. Used for personality traits and memory filters.

**`CompanionSlider`** — `primary` track and thumb, with the value shown as a label. Used for
personality levels, which the backend stores 0–100.

**`CompanionSwitch`** — the standard M3 switch. Always paired with a text label; never the sole
carrier of meaning.

**`CompanionBottomSheet`** — `ModalBottomSheet`, 28dp top radius, `surfaceContainerHigh`, drag
handle, `navigationBarsPadding()`.

**`CompanionDialog`** — `AlertDialog`, 28dp radius, `surfaceContainerHigh`. Destructive confirmations
put the destructive action in `error` and make it the *non*-default focus.

**`CompanionSnackbar`** — `inverseSurface` fill, 12dp radius, 16dp above the nav bar. Always icon
plus text. Error snackbars carry a retry action wherever a retry is possible.

**`LoadingIndicator`** — `CircularProgressIndicator` in `primary`, 24dp inline or 40dp full-screen.
Full-screen loading is a last resort; prefer a skeleton.

**`SkeletonLoader`** — `surfaceContainerHigh` blocks with a 1.2s shimmer, shaped like the content
they replace. Skip the shimmer under reduce-motion and show static blocks.

**`EmptyState`** — a line illustration or icon in `onSurfaceVariant`, a `headlineSmall` title, a
`bodyMedium` explanation, and an optional action. Each empty state must say what to do next, not
merely that there is nothing here.

**`ErrorState`** — same structure with the icon in `error` and a mandatory retry action. The offline
variant says "You're offline" and explains what still works, because in this app cached history does
still work.

---

## 6. Navigation

### 6.1 Structure

One root `NavHost`, four nested graphs, type-safe `@Serializable` routes (Navigation Compose 2.8+).

```
RootNavHost
├── Splash                      resolve session, decide entry
├── AuthGraph                   Welcome · Login · LoginEmail · Signup · ForgotPassword · ResetPassword(token)
├── OnboardingGraph             Intro · Personality · Appearance · Relationship · Finalize
└── MainGraph                   Scaffold + NavigationBar
    ├── Home
    ├── ChatGraph               Conversations → Conversation(id)
    ├── MemoryGraph             MemoryList → MemoryDetail(id)
    └── ProfileGraph            Profile → Settings/* · CompanionProfile(id) · Subscription
```

```kotlin
@Serializable data object Splash
@Serializable data object AuthGraph
@Serializable data object Login
@Serializable data class LoginEmail(val email: String? = null)
@Serializable data class ResetPassword(val token: String)
@Serializable data object MainGraph
@Serializable data class Conversation(val conversationId: Long)
@Serializable data class MemoryDetail(val memoryId: Long)
@Serializable data class CompanionProfile(val companionId: Long)
```

Splash branches three ways: no token goes to Auth; a valid token with no companion goes to
Onboarding; a valid token with a companion goes to Home. That is the only place session state drives
navigation, which keeps the rule easy to reason about and easy to test.

### 6.2 Four tabs, not five

The brief lists Home, Chat, Companion, Memory, and Profile. This design uses **four**: Home, Chat,
Memory, You.

Companion becomes a destination reached by tapping the companion herself — from the Home hero or the
chat app bar — rather than a peer tab. That gesture is what users already reach for, and it keeps her
the subject of the app rather than an item in a menu. Five tabs at 360dp also crowds the labels to
the point where they truncate at large font scales.

Memory stays a tab. User control over what the companion remembers is a trust feature and a genuine
differentiator; burying it two levels deep undercuts the entire point of building it.

The nav bar is built to take a fifth item if you disagree — it is a list, not a fixed layout.

### 6.3 Behaviour

Bottom bar is visible on the four tab roots and hidden on conversation detail, companion profile,
all settings sub-screens, and every auth and onboarding destination. Derive visibility from the
current destination's hierarchy rather than from a per-screen flag.

Each tab keeps its own back stack via `saveState` / `restoreState`. Re-selecting the active tab pops
that tab to its root. System back from a non-Home tab returns to Home; back from Home exits.

**Transitions:** fade-through at 200ms between tabs (no lateral slide between peers); shared X axis
at 300ms for push-to-detail and onboarding steps; a container transform on the shared avatar element
when opening chat from the Home hero.

**Deep links:** password reset now (`aicompanion://reset-password?token=…`), notification taps into a
thread later (`aicompanion://chat/{conversationId}`). Define both route patterns now even though only
the first is wired, so the second is not a refactor.

**Predictive back** is effectively mandatory at targetSdk 36. Set
`android:enableOnBackInvokedCallback="true"` and handle it explicitly on the chat composer — the one
screen with unsaved state worth confirming.

---

## 7. Accessibility

These are requirements, not aspirations. Each is cheap during implementation and expensive to
retrofit.

Touch targets are at least 48×48dp even where the visual is smaller. Contrast is verified in §2.4 and
must be re-verified on any token change.

**Never communicate by colour alone.** Every status carries an icon and text: success, warning, and
error rows must be distinguishable in greyscale. This is the rule most often broken by a snackbar
that signals success purely by turning green.

Form errors use `Modifier.semantics { error(message) }` so TalkBack announces them, alongside the
visible icon and message. The streaming assistant reply sets `liveRegion = LiveRegionMode.Polite` so
the response is announced as it arrives rather than silently appearing. Section headers get
`Modifier.semantics { heading() }`.

Test matrix: TalkBack end-to-end on the auth and chat flows, 200% font scale plus largest display
size on every screen, and both themes. Add Compose accessibility checks to the instrumented test
suite so regressions fail CI rather than review.

---

## 8. Decisions carried forward

Settled here: four bottom-nav tabs; Fraunces as a single static display weight; dynamic colour off;
champagne rather than amber as the secondary; 20dp screen gutter.

Worth confirming before Task 2 turns these tokens into screens:

**The fifth tab.** Reinstating Companion as a peer tab changes the nav bar, the Home hero, and the
chat app bar. Cheap to decide now, invasive later.

**Fraunces licensing and size.** If the licence or the ~40KB is a problem, the fallback is Plus
Jakarta Sans 300 at wider tracking, and the four display slots change with it. Worth checking before
the type scale is baked into screens.

**Illustration style for empty states.** Not specified here. It is the one remaining visual decision
that cannot be derived from the tokens, and it needs an answer before the empty states are built.
