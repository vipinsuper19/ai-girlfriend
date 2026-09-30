package com.dhama.mybase

import com.dhama.mybase.core.model.CompanionDraft
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CompanionDraftTest {

    @Test
    fun nameMustBeAtLeastTwoCharacters() {
        assertEquals("Her name needs at least 2 characters", CompanionDraft(name = " A ").nameError())
        assertNull(CompanionDraft(name = "Aria").nameError())
    }

    @Test
    fun traitToggleCapsAtFour() {
        val full = CompanionDraft(traits = listOf("Caring", "Playful", "Curious", "Calm"))
        assertEquals(full.traits, full.toggleTrait("Witty").traits)
        assertEquals(3, full.toggleTrait("Calm").traits.size)
    }

    @Test
    fun createRequestFoldsRelationshipIntoMetadataAndKeepsVoice() {
        val request = CompanionDraft(name = " Aria ", relationship = "Girlfriend", voiceId = "warm").toCreateRequest()
        assertEquals("Aria", request.name)
        assertEquals("FEMALE", request.gender)
        assertEquals("Girlfriend", request.personality.metadata["relationshipType"])
        assertEquals("warm", request.voice.voiceId)
        assertEquals("default", request.voice.provider)
        assertTrue(request.systemPrompt.contains("Girlfriend"))
        assertTrue(request.greeting.startsWith("Hi — I'm Aria"))
    }

    @Test
    fun skippedVoiceStillWritesADefault() {
        val request = CompanionDraft(name = "Aria").toCreateRequest()
        assertEquals("warm", request.voice.voiceId)
        assertTrue(request.voice.voiceId.isNotBlank())
    }
}
