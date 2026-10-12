import assert from 'node:assert/strict';
import test from 'node:test';

import { usageWindow } from './usage-window.js';

test('a day window is the UTC calendar day', () => {
    assert.deepEqual(
        usageWindow('day', new Date('2026-10-12T23:59:59.999Z')),
        {
            start: '2026-10-12T00:00:00.000Z',
            end: '2026-10-13T00:00:00.000Z',
        },
    );
    assert.deepEqual(
        usageWindow('day', new Date('2026-10-13T00:00:00.000Z')),
        {
            start: '2026-10-13T00:00:00.000Z',
            end: '2026-10-14T00:00:00.000Z',
        },
    );
});

test('a month window stays the UTC calendar month', () => {
    assert.deepEqual(
        usageWindow('month', new Date('2026-10-12T15:00:00.000Z')),
        {
            start: '2026-10-01T00:00:00.000Z',
            end: '2026-11-01T00:00:00.000Z',
        },
    );
});
