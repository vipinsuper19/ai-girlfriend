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
