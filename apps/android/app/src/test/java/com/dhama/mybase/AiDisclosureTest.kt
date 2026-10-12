package com.dhama.mybase

import com.dhama.mybase.core.chat.AiDisclosure
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AiDisclosureTest {

    @Test
    fun showsUntilThePersonAcknowledgesIt() {
        assertTrue(AiDisclosure.shouldShow(acknowledged = false))
        assertFalse(AiDisclosure.shouldShow(acknowledged = true))
    }
}
