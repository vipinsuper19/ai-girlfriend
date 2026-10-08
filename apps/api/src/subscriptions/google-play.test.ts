import assert from 'node:assert/strict';
import test from 'node:test';

import {
    currentSubscription,
    playAccountId,
    playProducts,
    playVerdict,
    type PlaySubscription,
} from './google-play.js';

const now = new Date('2026-10-08T12:00:00Z');
const account = playAccountId(7, 'secret');

function purchase(overrides: Partial<PlaySubscription> = {}): PlaySubscription {
    return {
        subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
        acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
        lineItems: [{ productId: 'premium_monthly', expiryTime: '2026-11-08T12:00:00Z' }],
        externalAccountIdentifiers: { obfuscatedExternalAccountId: account },
        ...overrides,
    };
}

test('products map only to paid plans', () => {
    const products = playProducts(' premium_monthly:PREMIUM, plus:PREMIUM_PLUS ,free:FREE,broken,');
    assert.deepEqual([...products], [['premium_monthly', 'PREMIUM'], ['plus', 'PREMIUM_PLUS']]);
    assert.equal(playProducts(undefined).size, 0);
});

test('account id is stable per user and fits Play limits', () => {
    assert.equal(account, playAccountId(7, 'secret'));
    assert.notEqual(account, playAccountId(8, 'secret'));
    assert.ok(account.length <= 64);
});

test('a live purchase for this user and product is accepted', () => {
    const verdict = playVerdict(purchase(), { productId: 'premium_monthly', accountId: account, now });
    assert.deepEqual(verdict, {
        ok: true,
        expiresAt: '2026-11-08T12:00:00.000Z',
        needsAcknowledge: true,
        linkedPurchaseToken: null,
    });
    const grace = playVerdict(
        purchase({ subscriptionState: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED', linkedPurchaseToken: 'old' }),
        { productId: 'premium_monthly', accountId: account, now },
    );
    assert.equal(grace.ok && grace.needsAcknowledge, false);
    assert.equal(grace.ok && grace.linkedPurchaseToken, 'old');
});

test('other accounts, states, products, and expired items are refused', () => {
    const expected = { productId: 'premium_monthly', accountId: account, now };
    const problem = (p: PlaySubscription, e = expected) => {
        const verdict = playVerdict(p, e);
        return verdict.ok ? null : verdict.problem;
    };
    assert.match(problem(purchase({ externalAccountIdentifiers: {} }))!, /different account/);
    assert.match(problem(purchase(), { ...expected, accountId: playAccountId(8, 'secret') })!, /different account/);
    assert.match(problem(purchase({ subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED' }))!, /not active/);
    assert.match(problem(purchase({ subscriptionState: 'SUBSCRIPTION_STATE_PENDING' }))!, /not active/);
    assert.match(problem(purchase(), { ...expected, productId: 'plus' })!, /different product/);
    assert.match(problem(purchase({ lineItems: [{ productId: 'premium_monthly', expiryTime: '2026-10-01T00:00:00Z' }] }))!, /expired/);
});

test('current subscription prefers paid and unexpired rows', () => {
    const free = { id: 1, plan: 'FREE', status: 'ACTIVE', expiresAt: null, createdAt: '2026-01-01T00:00:00Z' };
    const paid = { id: 2, plan: 'PREMIUM', status: 'ACTIVE', expiresAt: '2026-11-01T00:00:00Z', createdAt: '2025-12-01T00:00:00Z' };
    const lapsed = { id: 3, plan: 'PREMIUM_PLUS', status: 'ACTIVE', expiresAt: '2026-10-01T00:00:00Z', createdAt: '2026-09-01T00:00:00Z' };
    const canceled = { id: 4, plan: 'PREMIUM_PLUS', status: 'CANCELED', expiresAt: null, createdAt: '2026-09-02T00:00:00Z' };
    assert.equal(currentSubscription([free, paid, lapsed, canceled], now)?.id, 2);
    assert.equal(currentSubscription([free, lapsed], now)?.id, 1);
    assert.equal(currentSubscription([lapsed, canceled], now), null);
});
