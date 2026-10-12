package com.dhama.mybase.core.age

const val AGE_SEAL_PREFIX = "sealed:v1:"

/** Keystore-backed seal for a date of birth. The stored text must not be the raw date. */
interface AgeSeal {
    fun seal(plaintext: String): String

    fun open(sealed: String): String?

    fun discard()
}

/** True only when [sealed] is a prefixed ciphertext and does not contain the raw date. */
fun acceptsSealedAge(dateOfBirth: String, sealed: String): Boolean {
    if (dateOfBirth.isBlank() || sealed.isBlank()) return false
    if (!sealed.startsWith(AGE_SEAL_PREFIX)) return false
    return sealed != dateOfBirth && !sealed.contains(dateOfBirth)
}
