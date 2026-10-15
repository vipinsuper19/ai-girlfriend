import assert from 'node:assert/strict';
import test from 'node:test';

import {
    clearMinorHold,
    parseClearMinorHoldArgs,
    type MinorHoldRow,
    type MinorHoldStore,
} from './clear-minor-hold.js';

test('clear-minor-hold parses a user and an optional conversation', () => {
    assert.deepEqual(parseClearMinorHoldArgs(['--user', '4']), { userId: 4 });
    assert.deepEqual(parseClearMinorHoldArgs(['--user', '4', '--conversation', '9']), {
        userId: 4,
        conversationId: 9,
    });
    assert.throws(() => parseClearMinorHoldArgs([]), /--user/);
    assert.throws(() => parseClearMinorHoldArgs(['--user', '0']), /positive integer/);
    assert.throws(() => parseClearMinorHoldArgs(['--user', '4', '--nope']), /unexpected/);
});

test('clear-minor-hold clears the user and writes an audit line', async () => {
    const logs: string[] = [];
    const store = fakeStore({
        users: [{ id: 4, minorHeldAt: '2026-10-12T00:00:00.000Z' }],
        conversations: [
            { id: 9, userId: 4, minorHeldAt: '2026-10-12T00:00:00.000Z' },
            { id: 10, userId: 4, minorHeldAt: '2026-10-12T00:00:00.000Z' },
            { id: 11, userId: 5, minorHeldAt: '2026-10-12T00:00:00.000Z' },
        ],
    });

    await clearMinorHold(store, { userId: 4, conversationId: 9 }, (line) => logs.push(line));
    assert.equal(store.users[0]?.minorHeldAt, null);
    assert.equal(store.conversations.find((row) => row.id === 9)?.minorHeldAt, null);
    assert.ok(store.conversations.find((row) => row.id === 10)?.minorHeldAt);
    assert.match(logs[0] ?? '', /safety audit action=clear_minor_hold userId=4 conversationId=9/);
    assert.match(logs[0] ?? '', /clearedConversations=1 hadUserHold=1/);

    await clearMinorHold(store, { userId: 4 }, (line) => logs.push(line));
    assert.equal(store.conversations.find((row) => row.id === 10)?.minorHeldAt, null);
    assert.ok(store.conversations.find((row) => row.id === 11)?.minorHeldAt);
    assert.match(logs[1] ?? '', /conversationId=- clearedUser=1 clearedConversations=2 hadUserHold=0/);
});

test('clear-minor-hold refuses a missing user or conversation', async () => {
    const store = fakeStore({ users: [], conversations: [] });
    await assert.rejects(() => clearMinorHold(store, { userId: 4 }, () => {}), /user 4 not found/);
    store.users.push({ id: 4, minorHeldAt: null });
    await assert.rejects(
        () => clearMinorHold(store, { userId: 4, conversationId: 9 }, () => {}),
        /conversation 9 not found/,
    );
});

function fakeStore(seed: {
    users: MinorHoldRow[];
    conversations: (MinorHoldRow & { userId: number })[];
}) {
    return {
        users: seed.users,
        conversations: seed.conversations,
        async findUser(id: number) {
            return seed.users.find((row) => row.id === id) ?? null;
        },
        async clearUser(id: number) {
            const row = seed.users.find((item) => item.id === id);
            if (row) row.minorHeldAt = null;
        },
        async findConversation(id: number, userId: number) {
            return seed.conversations.find((row) => row.id === id && row.userId === userId) ?? null;
        },
        async listConversations(userId: number) {
            return seed.conversations.filter((row) => row.userId === userId);
        },
        async clearConversation(id: number, userId: number) {
            const row = seed.conversations.find((item) => item.id === id && item.userId === userId);
            if (row) row.minorHeldAt = null;
        },
    } satisfies MinorHoldStore & {
        users: MinorHoldRow[];
        conversations: (MinorHoldRow & { userId: number })[];
    };
}
