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
            },
        } as never,
    );

    const result = await service.deleteMe('7');

    assert.equal(result.message, 'Account deleted successfully');
    assert.deepEqual(order, ['files', 'user']);
});

test('a storage failure leaves the user row in place', async () => {
    let deleted = false;
    const service = new UsersService(
        userDb(() => {
            deleted = true;
        }) as never,
        {
            removeUserFiles: async () => {
                throw new Error('storage unavailable');
            },
        } as never,
    );

    await assert.rejects(() => service.deleteMe('7'), /storage unavailable/);
    assert.equal(deleted, false);
});
