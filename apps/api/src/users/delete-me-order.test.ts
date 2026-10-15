import assert from 'node:assert/strict';
import test from 'node:test';

import type { FirebaseAuthAdmin } from '../auth/firebase-auth-admin.js';
import { FirebaseAuthDeletion } from '../auth/firebase-auth-deletion.js';
import { UsersService } from './users.service.js';

function userDb(onDelete: () => void, accounts?: unknown[]) {
    return {
        client: {
            orm: {
                public: {
                    User: {
                        where: () => ({
                            first: async () => ({ id: 7, email: 'ada@example.com' }),
                        }),
                    },
                    Companion: {
                        where: () => ({
                            all: async () => [{ id: 3 }],
                        }),
                    },
                    ...(accounts
                        ? {
                            Account: {
                                where: () => ({
                                    all: async () => accounts,
                                }),
                            },
                        }
                        : {}),
                },
            },
            transaction: async () => {
                onDelete();
            },
        },
    };
}

function authCleanup(admin: FirebaseAuthAdmin) {
    const rows = new Map<string, { lastError: string }>();
    const deletion = new FirebaseAuthDeletion(admin);
    deletion.bindQuery(() => ({
        query: async (text: string, values: readonly unknown[] = []) => {
            if (text.includes('INSERT INTO "authCleanup"')) {
                rows.set(String(values[0]), { lastError: String(values[1]) });
                return { rows: [] };
            }
            if (text.includes('SELECT "subject"')) {
                return { rows: [...rows.keys()].map((subject) => ({ subject })) };
            }
            if (text.startsWith('DELETE')) {
                rows.delete(String(values[0]));
                return { rows: [] };
            }
            throw new Error(`unexpected sql: ${text}`);
        },
    }));
    return { deletion, rows };
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
    assert.equal(result.firebaseUserDeleted, false);
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

test('deleteMe calls Firebase deleteUser only after the user row is gone', async () => {
    const order: string[] = [];
    const admin: FirebaseAuthAdmin = {
        deleteUser: async (uid) => {
            order.push(`firebase:${uid}`);
        },
        getUserByEmail: async () => {
            throw new Error('lookup should not run when the uid is stored');
        },
    };
    const { deletion } = authCleanup(admin);
    const service = new UsersService(
        userDb(() => {
            order.push('user');
        }, [{ provider: 'GOOGLE', providerData: { firebaseUid: 'firebase-uid' } }]) as never,
        {
            removeUserFiles: async () => {
                order.push('files');
                return { failures: [], incomplete: false };
            },
        } as never,
        cleanupStub(order) as never,
        deletion,
    );

    try {
        const result = await service.deleteMe('7');
        assert.equal(result.message, 'Account deleted successfully');
        assert.equal(result.firebaseUserDeleted, true);
        assert.deepEqual(order, ['retry', 'files', 'user', 'firebase:firebase-uid']);
    } finally {
        deletion.stop();
    }
});

test('a Firebase failure after the row is gone still reports success and is queued', async () => {
    const order: string[] = [];
    const admin: FirebaseAuthAdmin = {
        deleteUser: async () => {
            order.push('firebase');
            throw Object.assign(new Error('auth backend failed'), { code: 'auth/internal-error' });
        },
        getUserByEmail: async () => ({ uid: 'unused' }),
    };
    const { deletion, rows } = authCleanup(admin);
    const service = new UsersService(
        userDb(() => {
            order.push('user');
        }, [{ provider: 'GOOGLE', providerData: { firebaseUid: 'firebase-uid' } }]) as never,
        {
            removeUserFiles: async () => {
                order.push('files');
                return { failures: [], incomplete: false };
            },
        } as never,
        cleanupStub(order) as never,
        deletion,
    );

    try {
        const result = await service.deleteMe('7');
        assert.equal(result.message, 'Account deleted successfully');
        assert.equal(result.firebaseUserDeleted, false);
        assert.deepEqual(order, ['retry', 'files', 'user', 'firebase']);
        assert.equal(rows.get('firebase-uid')?.lastError, 'auth backend failed');
    } finally {
        deletion.stop();
    }
});
