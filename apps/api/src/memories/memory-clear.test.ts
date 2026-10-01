import assert from 'node:assert/strict';
import test from 'node:test';

import { clearedCount } from './memory-clear.js';

const rows = [
    { id: 1, status: 'ACTIVE', deletedAt: null, companionId: 4 },
    { id: 2, status: 'ACTIVE', deletedAt: null, companionId: 9 },
    { id: 3, status: 'DELETED', deletedAt: '2026-01-01T00:00:00Z', companionId: 4 },
    { id: 4, status: 'ARCHIVED', deletedAt: null, companionId: 4 },
];

test('a wipe counts every active memory', () => {
    assert.equal(clearedCount(rows), 2);
});

test('a companion wipe leaves the others', () => {
    assert.equal(clearedCount(rows, 4), 1);
    assert.equal(clearedCount(rows, 9), 1);
    assert.equal(clearedCount(rows, 1), 0);
});
