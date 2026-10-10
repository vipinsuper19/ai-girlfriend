import assert from 'node:assert/strict';
import test from 'node:test';

import {
    lastMessageSnapshot,
    latestVisibleMessage,
} from './last-message.js';

test('the newest non-deleted message is the preview', () => {
    const picked = latestVisibleMessage([
        {
            id: 1,
            role: 'USER',
            type: 'TEXT',
            content: 'older',
            createdAt: '2026-01-01T00:00:00Z',
            deletedAt: null,
        },
        {
            id: 2,
            role: 'ASSISTANT',
            type: 'TEXT',
            content: 'newer',
            createdAt: '2026-01-02T00:00:00Z',
            deletedAt: null,
        },
        {
            id: 3,
            role: 'ASSISTANT',
            type: 'AUDIO',
            content: null,
            createdAt: '2026-01-03T00:00:00Z',
            deletedAt: '2026-01-04T00:00:00Z',
        },
    ]);

    assert.deepEqual(lastMessageSnapshot(picked), {
        id: 2,
        role: 'ASSISTANT',
        type: 'TEXT',
        content: 'newer',
    });
});

test('equal timestamps keep the higher id', () => {
    const picked = latestVisibleMessage([
        {
            id: 5,
            role: 'USER',
            type: 'TEXT',
            content: 'first',
            createdAt: '2026-01-02T00:00:00Z',
            deletedAt: null,
        },
        {
            id: 9,
            role: 'ASSISTANT',
            type: 'IMAGE',
            content: null,
            createdAt: '2026-01-02T00:00:00Z',
            deletedAt: null,
        },
    ]);

    assert.equal(picked?.id, 9);
    assert.equal(lastMessageSnapshot(picked)?.type, 'IMAGE');
    assert.equal(lastMessageSnapshot(picked)?.content, null);
});

test('a deleted-only thread has no preview', () => {
    assert.equal(
        latestVisibleMessage([
            {
                id: 1,
                role: 'USER',
                type: 'TEXT',
                content: 'gone',
                createdAt: '2026-01-01T00:00:00Z',
                deletedAt: '2026-01-02T00:00:00Z',
            },
        ]),
        null,
    );
    assert.equal(lastMessageSnapshot(null), null);
    assert.equal(
        lastMessageSnapshot({
            id: 1,
            role: 'USER',
            content: 'gone',
            deletedAt: '2026-01-02T00:00:00Z',
        }),
        null,
    );
});

test('a blank type becomes TEXT', () => {
    assert.deepEqual(
        lastMessageSnapshot({
            id: 4,
            role: null,
            type: ' ',
            content: null,
        }),
        {
            id: 4,
            role: 'USER',
            type: 'TEXT',
            content: null,
        },
    );
});
