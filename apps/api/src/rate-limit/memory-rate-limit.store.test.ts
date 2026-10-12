import assert from 'node:assert/strict';
import test from 'node:test';

import { MemoryRateLimitStore } from './memory-rate-limit.store.js';

test('allows up to the max and then reports retry-after', () => {
    const store = new MemoryRateLimitStore();
    const check = { key: 'login:ip:1.1.1.1', max: 2, windowMs: 10_000 };

    assert.equal(store.consume([check], 1_000).allowed, true);
    assert.equal(store.consume([check], 1_500).allowed, true);

    const blocked = store.consume([check], 2_000);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.retryAfterSeconds, 9);
});

test('a blocked dimension does not consume the others', () => {
    const store = new MemoryRateLimitStore();
    const ip = { key: 'ip', max: 2, windowMs: 10_000 };
    const user = { key: 'user-a', max: 1, windowMs: 10_000 };
    const other = { key: 'user-b', max: 1, windowMs: 10_000 };

    assert.equal(store.consume([ip, user], 0).allowed, true);
    assert.equal(store.consume([ip, user], 1).allowed, false);
    assert.equal(store.consume([ip, other], 2).allowed, true);
});

test('the window resets, and a max of zero is off', () => {
    const store = new MemoryRateLimitStore();
    const check = { key: 'messages:user:4', max: 1, windowMs: 1_000 };

    assert.equal(store.consume([check], 0).allowed, true);
    assert.equal(store.consume([check], 999).allowed, false);
    assert.equal(store.consume([check], 1_000).allowed, true);
    assert.equal(
        store.consume([{ key: 'off', max: 0, windowMs: 1_000 }], 0).allowed,
        true,
    );
});
