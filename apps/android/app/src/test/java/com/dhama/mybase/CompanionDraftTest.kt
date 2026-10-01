package com.dhama.mybase

import com.dhama.mybase.core.model.CompanionDraft
import com.dhama.mybase.core.model.SavedCompanion
import com.dhama.mybase.core.model.companionGender
import com.dhama.mybase.core.model.genderLabel
import com.dhama.mybase.core.model.genderPhrase
import com.dhama.mybase.core.model.voiceIdFor
import com.dhama.mybase.core.network.apiJson
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
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
    fun voiceLabelMapsBackToTheIdSentOnUpdate() {
        assertEquals("soft", voiceIdFor("Soft"))
        assertEquals("calm", voiceIdFor(" calm "))
        assertEquals("warm", voiceIdFor("unknown"))
    }

    @Test
    fun skippedVoiceStillWritesADefault() {
        val request = CompanionDraft(name = "Aria").toCreateRequest()
        assertEquals("warm", request.voice.voiceId)
        assertTrue(request.voice.voiceId.isNotBlank())
    }

    @Test
    fun genderStaysOneOfTheServerValues() {
        assertEquals("MALE", companionGender("male"))
        assertEquals("OTHER", companionGender("OTHER"))
        assertEquals("FEMALE", companionGender("nope"))
        assertEquals("Man", genderLabel("MALE"))
        assertEquals("Non-binary", genderLabel("OTHER"))
        assertEquals("a woman", genderPhrase(null))
        val request = CompanionDraft(name = "Aria", gender = "MALE").toCreateRequest()
        assertEquals("MALE", request.gender)
        assertTrue(request.systemPrompt.contains("a man"))
        assertEquals("MALE", CompanionDraft(name = "Aria", gender = "MALE").toSaved(1L).gender)
    }

    @Test
    fun lookFieldsRoundTripThroughSaveAndTheNextEdit() {
        val draft = CompanionDraft(
            name = "Aria",
            ethnicity = " South Asian ",
            bodyType = "Athletic",
            height = "5 ft 6 in",
            clothingStyle = " ",
            hairStyle = "Wavy",
        )
        val saved = draft.toSaved(1L)
        assertEquals("South Asian", saved.ethnicity)
        assertEquals("Athletic", saved.bodyType)
        assertEquals("5 ft 6 in", saved.height)
        assertNull(saved.clothingStyle)
        assertEquals("Wavy", saved.hairStyle)
        assertEquals(
            "Realistic · Brown hair · Blue eyes · Warm skin · South Asian · Athletic build · 5 ft 6 in · Wavy hair",
            saved.lookLine(),
        )
        val again = CompanionDraft(
            name = saved.name,
            style = saved.style,
            hairColor = saved.hairColor,
            eyeColor = saved.eyeColor,
            skinTone = saved.skinTone,
            ethnicity = saved.ethnicity,
            bodyType = saved.bodyType,
            height = saved.height,
            clothingStyle = saved.clothingStyle,
            hairStyle = saved.hairStyle,
        ).toCreateRequest()
        assertEquals("South Asian", again.appearance.ethnicity)
        assertEquals("Athletic", again.appearance.bodyType)
        assertEquals("5 ft 6 in", again.appearance.height)
        assertNull(again.appearance.clothingStyle)
        assertEquals("Wavy", again.appearance.hairStyle)
        val raw = apiJson().encodeToString(again)
        assertTrue(raw.contains("\"ethnicity\":\"South Asian\""))
        assertTrue(raw.contains("\"hairStyle\":\"Wavy\""))
        assertFalse(raw.contains("clothingStyle"))
        val older = apiJson().decodeFromString<SavedCompanion>(
            """{"name":"Aria","traits":[],"voiceLabel":"Warm","relationship":"Girlfriend","greeting":"Hi","style":"Realistic","systemPrompt":"","createdAtEpochMs":1}""",
        )
        assertNull(older.ethnicity)
        assertNull(older.hairStyle)
        assertEquals("Realistic · Brown hair · Blue eyes · Warm skin", older.lookLine())
    }
}
