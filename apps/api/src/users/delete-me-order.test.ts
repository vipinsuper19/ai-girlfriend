import assert from 'node:assert/strict';
import test from 'node:test';

import { UsersService } from './users.service.js';

function userDb(onDelete: () => void) {
    return {
        client: {
            orm: {
                public: {
                    User: {
                        where: () => ({
                            first: async () => ({ id: 7 }),
                        }),
                    },
                    Companion: {
                        where: () => ({
                            all: async () => [{ id: 3 }],
                        }),
                    },
                },
            },
            transaction: async () => {
                onDelete();
            },
        },
    };
}

function cleanupStub(order: string[]) {
    return {
        retryPending: async () => {
            order.push('retry');
        },
        record: async () => {
            order.push('record');
        },
    };
}

test('deleteMe removes stored files before the user row', async () => {
    const order: string[] = [];
    const service = new UsersService(
        userDb(() => {
            order.push('user');
        }) as never,
        {
            removeUserFiles: async (userId: number, companionIds: readonly number[]) => {
                order.push('files');
                assert.equal(userId, 7);
                assert.deepEqual(companionIds, [3]);
                return { failures: [], incomplete: false };
            },
        } as never,
        cleanupStub(order) as never,
    );

    const result = await service.deleteMe('7');

    assert.equal(result.message, 'Account deleted successfully');
    assert.deepEqual(order, ['retry', 'files', 'user']);
});

test('a storage failure leaves the user row in place', async () => {
    let deleted = false;
    const order: string[] = [];
    const service = new UsersService(
        userDb(() => {
            deleted = true;
        }) as never,
        {
            removeUserFiles: async () => {
                order.push('files');
                throw new Error('storage unavailable');
            },
        } as never,
        cleanupStub(order) as never,
    );

    await assert.rejects(() => service.deleteMe('7'), /storage unavailable/);
    assert.equal(deleted, false);
    assert.deepEqual(order, ['retry', 'files']);
});

test('recorded storage failures stay ahead of the user delete', async () => {
    const order: string[] = [];
    const service = new UsersService(
        userDb(() => {
            order.push('user');
        }) as never,
        {
            removeUserFiles: async () => {
                order.push('files');
                return {
                    failures: [{ key: 'voice/7/', error: 'timeout' }],
                    incomplete: false,
                };
            },
        } as never,
        {
            retryPending: async () => {
                order.push('retry');
            },
            record: async (failures: { key: string; error: string }[]) => {
                order.push('record');
                assert.deepEqual(failures, [{ key: 'voice/7/', error: 'timeout' }]);
            },
        } as never,
    );

    await service.deleteMe('7');
    assert.deepEqual(order, ['retry', 'files', 'record', 'user']);
});
