package com.dhama.mybase

import com.dhama.mybase.core.legal.privacyPolicyUrl
import com.dhama.mybase.core.legal.termsUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class LegalUrlTest {

    @Test
    fun pagesUseTheHostRootNotTheApiPrefix() {
        val base = "http://10.0.2.2:3001/api/v1/"
        assertEquals("http://10.0.2.2:3001/privacy", privacyPolicyUrl(base))
        assertEquals("http://10.0.2.2:3001/terms", termsUrl(base))
    }

    @Test
    fun pagesWorkWithoutATrailingSlash() {
        val base = "https://api.example.com/api/v1"
        assertEquals("https://api.example.com/privacy", privacyPolicyUrl(base))
        assertEquals("https://api.example.com/terms", termsUrl(base))
    }

    @Test
    fun placeholderReleaseBaseStaysOnTheHost() {
        val base = "https://api.example.invalid/api/v1/"
        assertEquals("https://api.example.invalid/privacy", privacyPolicyUrl(base))
        assertEquals("https://api.example.invalid/terms", termsUrl(base))
        assertFalse(privacyPolicyUrl(base).contains("/api/v1"))
        assertFalse(termsUrl(base).contains("/api/v1"))
    }

    @Test
    fun surroundingWhitespaceDoesNotChangeTheHost() {
        val base = "  https://api.example.com/api/v1/  "
        assertEquals("https://api.example.com/privacy", privacyPolicyUrl(base))
        assertEquals("https://api.example.com/terms", termsUrl(base))
    }
}
