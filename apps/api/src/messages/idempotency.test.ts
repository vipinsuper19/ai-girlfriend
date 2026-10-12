import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';

import {
    IDEMPOTENCY_TTL_MS,
    idempotencyFresh,
    parseIdempotencyKey,
} from './idempotency.js';

const KEY = '3f1c2a4e-7b90-4d1e-8c33-1a2b3c4d5e6f';

test('a blank idempotency key is the same as omitting it', () => {
    assert.equal(parseIdempotencyKey(undefined), null);
    assert.equal(parseIdempotencyKey(null), null);
    assert.equal(parseIdempotencyKey(''), null);
    assert.equal(parseIdempotencyKey('   '), null);
    assert.equal(parseIdempotencyKey([]), null);
});

test('a UUID key is stored in lowercase', () => {
    assert.equal(parseIdempotencyKey(KEY.toUpperCase()), KEY);
    assert.equal(parseIdempotencyKey([`  ${KEY}  `]), KEY);
});

test('a non-UUID idempotency key is rejected', () => {
    assert.throws(
        () => parseIdempotencyKey('not-a-uuid'),
        (error: unknown) => {
            assert.ok(error instanceof BadRequestException);
            const body = error.getResponse() as { code?: string };
            assert.equal(body.code, 'INVALID_IDEMPOTENCY_KEY');
            return true;
        },
    );
});

test('an idempotent send is fresh for 24 hours', () => {
    const now = Date.parse('2026-10-12T12:00:00.000Z');
    const created = new Date(now - IDEMPOTENCY_TTL_MS + 1).toISOString();
    const expired = new Date(now - IDEMPOTENCY_TTL_MS).toISOString();
    assert.equal(idempotencyFresh(created, now), true);
    assert.equal(idempotencyFresh(expired, now), false);
    assert.equal(idempotencyFresh(null, now), false);
});
