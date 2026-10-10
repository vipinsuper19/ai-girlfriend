import assert from 'node:assert/strict';
import test from 'node:test';

import {
    accountCanSignIn,
    sessionExpired,
    sessionIsLive,
} from './session-state.js';

const now = new Date('2026-10-08T10:00:00.000Z');

test('a session string in the past is expired', () => {
    assert.equal(sessionExpired('2026-10-08T09:59:59.000Z', now), true);
    assert.equal(sessionExpired('2026-10-09T00:00:00.000Z', now), false);
    assert.equal(sessionExpired(new Date('2026-10-09T00:00:00.000Z'), now), false);
});

test('a missing or unreadable expiry is expired', () => {
    assert.equal(sessionExpired(null, now), true);
    assert.equal(sessionExpired('soon', now), true);
});

test('a token needs its own live session row', () => {
    const row = { userId: 3, expiresAt: '2026-11-01T00:00:00.000Z' };
    assert.equal(sessionIsLive(row, '3', now), true);
    assert.equal(sessionIsLive(row, '4', now), false);
    assert.equal(sessionIsLive(null, '3', now), false);
    assert.equal(
        sessionIsLive({ userId: 3, expiresAt: '2026-10-01T00:00:00.000Z' }, '3', now),
        false,
    );
});

test('only active accounts sign in', () => {
    assert.equal(accountCanSignIn('ACTIVE'), true);
    assert.equal(accountCanSignIn(undefined), true);
    assert.equal(accountCanSignIn('SUSPENDED'), false);
    assert.equal(accountCanSignIn('DELETED'), false);
});
