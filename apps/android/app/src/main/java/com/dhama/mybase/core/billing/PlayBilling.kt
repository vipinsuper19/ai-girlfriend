package com.dhama.mybase.core.billing

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.android.billingclient.api.queryProductDetails
import com.android.billingclient.api.queryPurchasesAsync
import com.dhama.mybase.core.data.AccountSync
import com.dhama.mybase.core.network.ApiClient
import com.dhama.mybase.core.network.planLabel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.concurrent.atomic.AtomicBoolean
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.cancellation.CancellationException
import kotlin.coroutines.resume

data class PlayOffer(
    val productId: String,
    val plan: String,
    val price: String,
    internal val details: ProductDetails,
    internal val offerToken: String,
)

/**
 * Play only takes the money; the plan changes after the API verifies the purchase
 * token with Google and finds this account's obfuscated id on it.
 */
@Singleton
class PlayBilling @Inject constructor(
    @ApplicationContext context: Context,
    private val api: ApiClient,
    private val accountSync: AccountSync,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _notes = MutableSharedFlow<String>(extraBufferCapacity = 4)
    val notes: SharedFlow<String> = _notes.asSharedFlow()
    private var accountId: String? = null

    private val client = BillingClient.newBuilder(context)
        .setListener { result, purchases ->
            when (result.responseCode) {
                BillingClient.BillingResponseCode.OK -> scope.launch { verifyAll(purchases.orEmpty()) }
                BillingClient.BillingResponseCode.USER_CANCELED -> Unit
                else -> _notes.tryEmit("Google Play couldn't finish that purchase.")
            }
        }
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .enableAutoServiceReconnection()
        .build()

    private suspend fun connect(): Boolean {
        if (client.isReady) return true
        return suspendCancellableCoroutine { continuation ->
            val done = AtomicBoolean(false)
            client.startConnection(object : BillingClientStateListener {
                override fun onBillingSetupFinished(result: BillingResult) {
                    if (done.compareAndSet(false, true)) {
                        continuation.resume(result.responseCode == BillingClient.BillingResponseCode.OK)
                    }
                }

                override fun onBillingServiceDisconnected() {
                    if (done.compareAndSet(false, true)) continuation.resume(false)
                }
            })
        }
    }

    /** Empty unless the server sells plans through Play and Play returns the products. */
    suspend fun offers(): List<PlayOffer> {
        if (!api.hasSession()) return emptyList()
        val config = api.googlePlayConfig()
        if (!config.configured || config.accountId.isNullOrBlank() || config.products.isEmpty()) return emptyList()
        if (!connect()) return emptyList()
        accountId = config.accountId
        val plans = config.products.associate { it.productId to it.plan }
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(
                config.products.map {
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(it.productId)
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build()
                },
            )
            .build()
        val result = client.queryProductDetails(params)
        if (result.billingResult.responseCode != BillingClient.BillingResponseCode.OK) return emptyList()
        return result.productDetailsList.orEmpty().mapNotNull { details ->
            val offer = details.subscriptionOfferDetails?.firstOrNull() ?: return@mapNotNull null
            val price = offer.pricingPhases.pricingPhaseList.lastOrNull()?.formattedPrice ?: return@mapNotNull null
            val plan = plans[details.productId] ?: return@mapNotNull null
            PlayOffer(details.productId, planLabel(plan), price, details, offer.offerToken)
        }
    }

    fun launch(activity: Activity, offer: PlayOffer): Boolean {
        val account = accountId ?: return false
        val params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(
                listOf(
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(offer.details)
                        .setOfferToken(offer.offerToken)
                        .build(),
                ),
            )
            .setObfuscatedAccountId(account)
            .build()
        return client.launchBillingFlow(activity, params).responseCode == BillingClient.BillingResponseCode.OK
    }

    /** Re-sends owned subscriptions so renewals and purchases made while offline reach the server. */
    suspend fun syncOwned() {
        if (!api.hasSession() || !connect()) return
        val owned = client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
        )
        if (owned.billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
            verifyAll(owned.purchasesList, quiet = true)
        }
    }

    private suspend fun verifyAll(purchases: List<Purchase>, quiet: Boolean = false) {
        var changed = false
        for (purchase in purchases) {
            if (purchase.purchaseState == Purchase.PurchaseState.PENDING) {
                if (!quiet) _notes.tryEmit("Your payment is pending. The plan starts once Google Play confirms it.")
                continue
            }
            if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED) continue
            for (productId in purchase.products) {
                try {
                    api.verifyGooglePlay(productId, purchase.purchaseToken)
                    changed = true
                } catch (error: CancellationException) {
                    throw error
                } catch (error: Exception) {
                    if (!quiet) _notes.tryEmit(error.message?.takeIf { it.isNotBlank() } ?: "Couldn't confirm that purchase.")
                }
            }
        }
        if (changed) {
            accountSync.refreshPlan()
            if (!quiet) _notes.tryEmit("Your plan is active.")
        }
    }
}
