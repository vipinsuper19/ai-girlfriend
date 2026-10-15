import assert from 'node:assert/strict';
import test from 'node:test';

import { attestedAt } from './age.js';

const now = new Date('2026-10-12T15:04:05.000Z');

test('ageConfirmed true stores the server time and nothing else', () => {
    assert.equal(attestedAt(true, now), '2026-10-12T15:04:05.000Z');
    assert.equal(attestedAt(false, now), null);
    assert.equal(attestedAt(undefined, now), null);
    assert.equal(attestedAt('1991-03-17', now), null);
});
