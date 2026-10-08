import { createHmac } from 'node:crypto';

export type PaidPlan = 'PREMIUM' | 'PREMIUM_PLUS';

const PAID_PLANS: readonly string[] = ['PREMIUM', 'PREMIUM_PLUS'];
const LIVE_STATES = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'];
const CURRENT_STATUSES = ['ACTIVE', 'TRIALING', 'PAST_DUE'];

/** GOOGLE_PLAY_PRODUCTS="premium_monthly:PREMIUM,plus_monthly:PREMIUM_PLUS" */
export function playProducts(value: string | undefined | null): Map<string, PaidPlan> {
    const products = new Map<string, PaidPlan>();
    for (const entry of (value ?? '').split(',')) {
        const [productId, plan] = entry.split(':').map((part) => part?.trim());
        if (productId && plan && PAID_PLANS.includes(plan)) {
            products.set(productId, plan as PaidPlan);
        }
    }
    return products;
}

/** Passed to Play as obfuscatedAccountId so a purchase can only be claimed by the buyer. */
export function playAccountId(userId: number, secret: string): string {
    return createHmac('sha256', secret).update(`google-play:${userId}`).digest('hex');
}

export type PlaySubscription = {
    subscriptionState?: string;
    acknowledgementState?: string;
    linkedPurchaseToken?: string;
    lineItems?: Array<{ productId?: string; expiryTime?: string }>;
    externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
};

export type PlayVerdict =
    | { ok: true; expiresAt: string; needsAcknowledge: boolean; linkedPurchaseToken: string | null }
    | { ok: false; problem: string };

export function playVerdict(
    purchase: PlaySubscription,
    expected: { productId: string; accountId: string; now: Date },
): PlayVerdict {
    if (purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId !== expected.accountId) {
        return { ok: false, problem: 'This purchase belongs to a different account' };
    }
    if (!LIVE_STATES.includes(purchase.subscriptionState ?? '')) {
        return { ok: false, problem: 'This subscription is not active' };
    }

    const item = (purchase.lineItems ?? []).find((line) => line.productId === expected.productId);
    const expiry = item?.expiryTime ? new Date(item.expiryTime) : null;
    if (!item || !expiry || Number.isNaN(expiry.getTime())) {
        return { ok: false, problem: 'This purchase is for a different product' };
    }
    if (expiry.getTime() <= expected.now.getTime()) {
        return { ok: false, problem: 'This subscription has expired' };
    }

    return {
        ok: true,
        expiresAt: expiry.toISOString(),
        needsAcknowledge: purchase.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING',
        linkedPurchaseToken: purchase.linkedPurchaseToken ?? null,
    };
}

type SubscriptionRow = {
    plan: string;
    status: string;
    expiresAt?: string | null;
    createdAt: string;
};

export function subscriptionLapsed(row: SubscriptionRow, now: Date): boolean {
    return row.expiresAt != null && new Date(row.expiresAt).getTime() <= now.getTime();
}

/** A paid, unexpired subscription wins over FREE; ties go to the newest. */
export function currentSubscription<T extends SubscriptionRow>(rows: T[], now: Date): T | null {
    const live = rows.filter((row) => CURRENT_STATUSES.includes(row.status) && !subscriptionLapsed(row, now));
    live.sort((a, b) => {
        const paid = Number(b.plan !== 'FREE') - Number(a.plan !== 'FREE');
        return paid || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return live[0] ?? null;
}
