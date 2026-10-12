import assert from 'node:assert/strict';
import test from 'node:test';

import { deleteAccountStorageFirst } from './account-deletion.js';

test('a failed object delete is recorded before the user row is removed', async () => {
    const order: string[] = [];

    await deleteAccountStorageFirst({
        removeFiles: async () => {
            order.push('storage');
            return {
                failures: [{ key: 'voice/3/', error: 'timeout' }],
                incomplete: false,
            };
        },
        recordFailures: async (failures) => {
            order.push('record');
            assert.deepEqual(failures, [{ key: 'voice/3/', error: 'timeout' }]);
        },
        deleteUser: async () => {
            order.push('user');
        },
    });

    assert.deepEqual(order, ['storage', 'record', 'user']);
});

test('a cleanup write failure leaves the user row in place', async () => {
    let deleted = false;

    await assert.rejects(
        () => deleteAccountStorageFirst({
            removeFiles: async () => ({
                failures: [{ key: 'images/3/', error: 'denied' }],
                incomplete: false,
            }),
            recordFailures: async () => {
                throw new Error('cleanup table down');
            },
            deleteUser: async () => {
                deleted = true;
            },
        }),
        /cleanup table down/,
    );

    assert.equal(deleted, false);
});

test('an incomplete portrait listing is recorded and does not delete the user', async () => {
    const order: string[] = [];

    await assert.rejects(
        () => deleteAccountStorageFirst({
            removeFiles: async () => {
                order.push('storage');
                return {
                    failures: [{ key: 'voice/3/', error: 'timeout' }],
                    incomplete: true,
                };
            },
            recordFailures: async () => {
                order.push('record');
            },
            deleteUser: async () => {
                order.push('user');
            },
        }),
        /could not be listed/,
    );

    assert.deepEqual(order, ['storage', 'record']);
});

test('a clean removal deletes the user without writing the cleanup table', async () => {
    let recorded = false;
    let deleted = false;

    await deleteAccountStorageFirst({
        removeFiles: async () => ({ failures: [], incomplete: false }),
        recordFailures: async () => {
            recorded = true;
        },
        deleteUser: async () => {
            deleted = true;
        },
    });

    assert.equal(recorded, false);
    assert.equal(deleted, true);
});

test('a storage error before any result leaves the user row in place', async () => {
    let deleted = false;

    await assert.rejects(
        () => deleteAccountStorageFirst({
            removeFiles: async () => {
                throw new Error('storage unavailable');
            },
            recordFailures: async () => {
                throw new Error('should not record');
            },
            deleteUser: async () => {
                deleted = true;
            },
        }),
        /storage unavailable/,
    );

    assert.equal(deleted, false);
});
