import assert from 'node:assert/strict';
import test from 'node:test';

import { isProviderQuotaError } from '../ai/generation-unavailable.js';
import { degradedReason, withAttemptTimeout } from './classifier-attempt.js';

test('429 and resource exhausted are a quota failure', () => {
    assert.equal(degradedReason(Object.assign(new Error('no'), { status: 429 })), '429');
    assert.equal(degradedReason(Object.assign(new Error('no'), { statusCode: '429' })), '429');
    assert.equal(degradedReason(Object.assign(new Error('no'), { code: 'RESOURCE_EXHAUSTED' })), '429');
    assert.equal(degradedReason(new Error('resource exhausted')), '429');
    assert.equal(degradedReason(Object.assign(new Error('no'), { error: { status: 'UNAVAILABLE' } })), '503');
});

test('timeouts and other failures stay distinct from quota', () => {
    const timeout = new Error('slow');
    timeout.name = 'TimeoutError';
    assert.equal(degradedReason(timeout), 'timeout');
    assert.equal(degradedReason(Object.assign(new Error('no'), { code: 'ETIMEDOUT' })), 'timeout');
    assert.equal(degradedReason(Object.assign(new Error('no'), { status: 503 })), '503');
    assert.equal(degradedReason(new Error('socket hang up')), 'unavailable');
});

test('a wrapped cause still counts as a provider quota error', () => {
    const wrapped = new Error('outer');
    (wrapped as Error & { cause?: unknown }).cause = Object.assign(new Error('inner'), { status: 429 });
    assert.equal(isProviderQuotaError(wrapped), true);
    assert.equal(isProviderQuotaError(new Error('nope')), false);
    assert.equal(degradedReason(new Error('nope')), 'unavailable');
});

test('one attempt rejects a hang and ignores a late rejection', async () => {
    await assert.rejects(
        () => withAttemptTimeout(new Promise(() => {}), 20),
        (error: unknown) => {
            assert.ok(error instanceof Error);
            assert.equal(error.name, 'TimeoutError');
            return true;
        },
    );

    let late: (error: unknown) => void = () => {};
    const hanging = new Promise((_resolve, reject) => {
        late = reject;
    });
    await assert.rejects(() => withAttemptTimeout(hanging, 20), /timed out/);
    late(new Error('late CANARY'));
    await new Promise((resolve) => setImmediate(resolve));
});
