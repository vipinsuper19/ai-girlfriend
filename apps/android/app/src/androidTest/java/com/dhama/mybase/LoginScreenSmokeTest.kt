package com.dhama.mybase

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.rules.TestRule
import org.junit.runner.Description
import org.junit.runner.RunWith
import org.junit.runners.model.Statement

/**
 * Launch harness for instrumented tests. QA can add flows beside this class.
 *
 * The emulator workflow passes the API origin two ways:
 * - Gradle `-PAPI_BASE_URL`, baked into [BuildConfig.API_BASE_URL]
 * - instrumentation argument `apiBaseUrl`
 *   (`-Pandroid.testInstrumentationRunnerArguments.apiBaseUrl`)
 */
@RunWith(AndroidJUnit4::class)
class LoginScreenSmokeTest {
    private val composeRule = createAndroidComposeRule<MainActivity>()

    @get:Rule
    val rules: TestRule = RuleChain
        .outerRule(EnsureFirebaseApp())
        .around(composeRule)

    @Test
    fun appLaunchesAndLoginScreenRenders() {
        val fromArgs = InstrumentationRegistry.getArguments().getString("apiBaseUrl")
        if (!fromArgs.isNullOrBlank()) {
            assertEquals(fromArgs, BuildConfig.API_BASE_URL)
        }

        composeRule.waitUntil(timeoutMillis = 20_000) {
            composeRule.onAllNodesWithText("I already have an account").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithText("I already have an account").performClick()
        composeRule.waitUntil(timeoutMillis = 10_000) {
            composeRule.onAllNodesWithText("Welcome back!").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithText("Welcome back!").assertIsDisplayed()
        composeRule.onNodeWithText("Login to your account").assertIsDisplayed()
    }
}

/**
 * Gate and settings read Firebase Auth as soon as the activity starts.
 * A checkout without google-services.json has no FirebaseInitProvider, so
 * start a local app before launch. A real google-services.json still wins.
 */
private class EnsureFirebaseApp : TestRule {
    override fun apply(base: Statement, description: Description): Statement {
        return object : Statement() {
            override fun evaluate() {
                val context = InstrumentationRegistry.getInstrumentation().targetContext
                if (FirebaseApp.getApps(context).isEmpty()) {
                    FirebaseApp.initializeApp(
                        context,
                        FirebaseOptions.Builder()
                            .setApplicationId("1:123456789012:android:abcdef1234567890")
                            .setApiKey("AIzaSyDummyKeyForInstrumentedSmokeOnly")
                            .setProjectId("local-instrumented-smoke")
                            .build(),
                    )
                }
                base.evaluate()
            }
        }
    }
}
