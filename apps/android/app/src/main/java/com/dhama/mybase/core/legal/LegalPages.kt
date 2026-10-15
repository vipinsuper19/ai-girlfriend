package com.dhama.mybase.core.legal

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.browser.customtabs.CustomTabsClient
import androidx.browser.customtabs.CustomTabsIntent
import com.dhama.mybase.core.network.apiOrigin

/**
 * Play Store pages are served at the API host root.
 * [com.dhama.mybase.BuildConfig.API_BASE_URL] ends in `/api/v1/`, and that prefix 404s for these pages.
 */
fun privacyPolicyUrl(apiBaseUrl: String): String = legalPageUrl(apiBaseUrl, "privacy")

fun termsUrl(apiBaseUrl: String): String = legalPageUrl(apiBaseUrl, "terms")

internal fun legalPageUrl(apiBaseUrl: String, page: String): String {
    val origin = apiOrigin(apiBaseUrl).trimEnd('/')
    return "$origin/${page.trim('/')}"
}

/**
 * Opens [url] in a Custom Tab. If no Custom Tabs browser is installed, opens a normal browser.
 * Shows a message when neither can handle the link.
 */
fun openLegalPage(context: Context, url: String) {
    val uri = Uri.parse(url)
    val launchContext = context.findActivity() ?: context
    val customTabsPackage = CustomTabsClient.getPackageName(context, null)
    if (customTabsPackage != null) {
        val tabs = CustomTabsIntent.Builder().build()
        tabs.intent.setPackage(customTabsPackage)
        if (launchContext !is Activity) {
            tabs.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try {
            tabs.launchUrl(launchContext, uri)
            return
        } catch (_: ActivityNotFoundException) {
            // The Custom Tabs package disappeared or refused this URL.
        }
    }
    val view = Intent(Intent.ACTION_VIEW, uri).apply {
        addCategory(Intent.CATEGORY_BROWSABLE)
        if (launchContext !is Activity) {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
    }
    try {
        launchContext.startActivity(view)
    } catch (_: ActivityNotFoundException) {
        Toast.makeText(context, "Couldn't open this link. No browser is available.", Toast.LENGTH_LONG).show()
    }
}

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}
