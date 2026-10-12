package com.dhama.mybase.core.auth

import android.content.Context

/**
 * Web client id written by the Google Services plugin from google-services.json.
 * Empty when that file was not present at build time, so the app still compiles.
 */
fun googleWebClientId(context: Context): String {
    val resId = context.resources.getIdentifier("default_web_client_id", "string", context.packageName)
    if (resId == 0) return ""
    return context.getString(resId)
}
