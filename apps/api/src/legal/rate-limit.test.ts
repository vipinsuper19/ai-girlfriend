import assert from 'node:assert/strict';
import test from 'node:test';

import { SlidingWindowLimiter } from './rate-limit.js';

test('the deletion limiter allows a fixed number of hits per window', () => {
    let now = 1_000;
    const limiter = new SlidingWindowLimiter(2, 60_000, () => now);
    assert.equal(limiter.allow('1.2.3.4'), true);
    assert.equal(limiter.allow('1.2.3.4'), true);
    assert.equal(limiter.allow('1.2.3.4'), false);
    assert.equal(limiter.allow('5.6.7.8'), true);

    now += 60_000;
    assert.equal(limiter.allow('1.2.3.4'), true);
});

test('the limiter sweeps expired keys and stays within its cap', () => {
    let now = 5_000;
    const limiter = new SlidingWindowLimiter(1, 60_000, () => now, 2);
    assert.equal(limiter.allow('a'), true);
    assert.equal(limiter.allow('a'), false);
    assert.equal(limiter.allow('b'), true);
    assert.equal(limiter.size, 2);

    assert.equal(limiter.allow('c'), true);
    assert.equal(limiter.size, 2);
    assert.equal(limiter.allow('a'), true);

    now += 60_000;
    assert.equal(limiter.allow('fresh'), true);
    assert.equal(limiter.size, 1);
});
