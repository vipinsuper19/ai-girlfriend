package com.dhama.mybase.core.utils

import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey

object Constants {

    enum class Prefs() {
        LOGGED,STEP,GOALS,UID, NAME, DOB, GENDER
    }

//    fun onBoardingSteps(step: Int): Any {
//        return when (step) {
//            0 -> {
//                NameRoute
//            }
//            1 -> {
//                DobRoute
//            }
//            2 -> {
//                GenderRoute
//            }
//            else -> {
//                HomeRoute
//            }
//        }
//    }

}

object PreferencesKeys {
    val USER_EMAIL = stringPreferencesKey("user_email")
    val DISPLAY_NAME = stringPreferencesKey("display_name")
    val THEME_MODE = stringPreferencesKey("theme_mode")
    val IS_LOGGED_IN = booleanPreferencesKey("is_logged_in")
    val IS_GOAL_SET = booleanPreferencesKey("is_goal_set")
    val SCREEN_PRIVACY = booleanPreferencesKey("screen_privacy")
    val USAGE_WARNING_PERIOD = stringPreferencesKey("usage_warning_period")
    val SUBSCRIPTION_PLAN = stringPreferencesKey("subscription_plan")
}