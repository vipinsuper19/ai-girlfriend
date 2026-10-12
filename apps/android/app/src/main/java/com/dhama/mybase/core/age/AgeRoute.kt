package com.dhama.mybase.core.age

import java.time.LocalDate

/**
 * Where a session goes after splash.
 * Home is only for someone signed in, tied to this confirmation, and 18 or older.
 */
enum class AgeRoute {
    Welcome,
    ConfirmAge,
    Onboarding,
    Home,
}

fun ageSubject(uid: String?, email: String?): String {
    val id = uid?.trim().orEmpty()
    if (id.isNotEmpty()) return id
    return email?.trim()?.lowercase().orEmpty()
}

fun parseDateOfBirth(iso: String?): LocalDate? {
    val text = iso?.trim().orEmpty()
    if (text.isEmpty()) return null
    return runCatching { LocalDate.parse(text) }.getOrNull()
}

fun ageRoute(
    loggedIn: Boolean,
    ageConfirmed: Boolean,
    dateOfBirth: LocalDate?,
    storedSubject: String,
    currentSubject: String,
    hasCompanion: Boolean,
    today: LocalDate,
): AgeRoute {
    if (!loggedIn) return AgeRoute.Welcome
    val samePerson = currentSubject.isNotBlank() && storedSubject == currentSubject
    val allowed = samePerson && evaluateAgeGate(ageConfirmed, dateOfBirth, today).allowed
    if (!allowed) return AgeRoute.ConfirmAge
    return if (hasCompanion) AgeRoute.Home else AgeRoute.Onboarding
}
