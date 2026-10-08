import assert from 'node:assert/strict';
import test from 'node:test';

import { memoryListWhere, needsReembedding } from './memory-list.js';

test('the list query carries every filter', () => {
    assert.deepEqual(
        memoryListWhere('3', { type: 'FACT', companionId: 4, conversationId: 9 }),
        {
            userId: 3,
            status: 'ACTIVE',
            deletedAt: null,
            type: 'FACT',
            companionId: 4,
            conversationId: 9,
        },
    );
});

test('an empty query lists all active rows for the user', () => {
    assert.deepEqual(memoryListWhere(3, {}), {
        userId: 3,
        status: 'ACTIVE',
        deletedAt: null,
    });
});

test('only a changed content needs a new embedding', () => {
    assert.equal(needsReembedding('likes tea', 'likes coffee'), true);
    assert.equal(needsReembedding('likes tea', 'likes tea'), false);
    assert.equal(needsReembedding('likes tea', undefined), false);
});
