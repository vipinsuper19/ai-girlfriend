import assert from 'node:assert/strict';
import test from 'node:test';

import {
    MESSAGE_PAGE_MAX,
    messagePage,
    messagePageLimit,
} from './message-page.js';

const rows = [
    { id: 1, createdAt: '2026-01-01T00:00:00Z', content: 'one' },
    { id: 2, createdAt: '2026-01-02T00:00:00Z', content: 'two' },
    { id: 4, createdAt: '2026-01-04T00:00:00Z', content: 'four' },
    {
        id: 3,
        createdAt: '2026-01-03T00:00:00Z',
        content: 'gone',
        deletedAt: '2026-01-05T00:00:00Z',
    },
    { id: 5, createdAt: '2026-01-04T00:00:00Z', content: 'five' },
];

test('no cursor returns the whole visible thread oldest first', () => {
    assert.deepEqual(
        messagePage(rows, {}).map((row) => row.id),
        [1, 2, 4, 5],
    );
});

test('limit keeps the newest page and before walks older', () => {
    assert.deepEqual(
        messagePage(rows, { limit: 2 }).map((row) => row.id),
        [4, 5],
    );
    assert.deepEqual(
        messagePage(rows, { before: 4, limit: 2 }).map((row) => row.id),
        [1, 2],
    );
    assert.deepEqual(messagePage(rows, { before: 1, limit: 2 }), []);
});

test('a limit above the max is clamped', () => {
    assert.equal(messagePageLimit(null), null);
    assert.equal(messagePageLimit(500), MESSAGE_PAGE_MAX);
    assert.equal(messagePage(rows, { limit: 500 }).length, 4);
});
