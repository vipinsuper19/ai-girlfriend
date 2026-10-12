import assert from 'node:assert/strict';
import test from 'node:test';

import { UsersService } from './users.service.js';

function account(email = 'User@Example.com') {
    const calls: string[] = [];
    const chain = (name: string, first?: () => unknown) => ({
        where() {
            return this;
        },
        all: async () => (name === 'session' ? [{ id: 1 }] : [{ id: 9 }]),
        first: async () => (first ? first() : undefined),
        delete: async () => {
            calls.push(name);
        },
        deleteAndCount: async () => {
            calls.push(name);
            return 1;
        },
    });
    const client = {
        orm: {
            public: {
                User: chain('user', () => ({ id: 3, email })),
                Session: chain('session'),
                Companion: chain('companion'),
                DeletionRequest: chain('deletion-requests'),
            },
        },
        raw: {
            sql() {
                return {
                    returnsRow() {
                        return { build: () => ({ kind: 'probe' }) };
                    },
                    affectedCount() {
                        return { build: () => ({ kind: 'delete' }) };
                    },
                };
            },
        },
        async transaction(fn: (tx: unknown) => Promise<void>) {
            await fn({
                orm: this.orm,
                query: async () => [{ name: null }],
                execute: async () => undefined,
            });
        },
    };
    return { client, calls };
}

function service(
    client: unknown,
    removeUserFiles: () => Promise<{ failures: { key: string; error: string }[]; incomplete: boolean }>,
    record: (failures: readonly { key: string; error: string }[]) => Promise<void> = async () => {},
) {
    const order: string[] = [];
    const cleanup = {
        retryPending: async () => {
            order.push('retry');
        },
        record: async (failures: readonly { key: string; error: string }[]) => {
            order.push('record');
            await record(failures);
        },
    };
    const storage = {
        removeUserFiles: async () => {
            order.push('storage');
            return removeUserFiles();
        },
    };
    return {
        order,
        users: new UsersService({ client } as never, storage as never, cleanup as never),
    };
}

test('account deletion removes files, then deletion requests, then the user row', async () => {
    const { client, calls } = account();
    const { order, users } = service(client, async () => ({ failures: [], incomplete: false }));

    await users.deleteMe('3');

    assert.deepEqual(order, ['retry', 'storage']);
    assert.deepEqual(calls, ['deletion-requests', 'user']);
});

test('a failed object delete is recorded, then deletion requests and the user row go', async () => {
    const { client, calls } = account();
    const recorded: { key: string; error: string }[][] = [];
    const { order, users } = service(
        client,
        async () => ({ failures: [{ key: 'voice/3/', error: 'timeout' }], incomplete: false }),
        async (failures) => {
            recorded.push([...failures]);
        },
    );

    await users.deleteMe('3');

    assert.deepEqual(order, ['retry', 'storage', 'record']);
    assert.deepEqual(recorded, [[{ key: 'voice/3/', error: 'timeout' }]]);
    assert.deepEqual(calls, ['deletion-requests', 'user']);
});

test('an incomplete file listing leaves the account and its deletion requests', async () => {
    const { client, calls } = account();
    const { order, users } = service(
        client,
        async () => ({ failures: [], incomplete: true }),
    );

    await assert.rejects(() => users.deleteMe('3'), /could not be listed/);

    assert.deepEqual(order, ['retry', 'storage']);
    assert.deepEqual(calls, []);
});
