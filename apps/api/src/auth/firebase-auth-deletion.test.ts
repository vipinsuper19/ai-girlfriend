import assert from 'node:assert/strict';
import test from 'node:test';

import {
    emailCleanupSubject,
    firebaseAdminConfigProblem,
    firebaseDeletionTargets,
    isFirebaseUserNotFound,
    type FirebaseAuthAdmin,
} from './firebase-auth-admin.js';
import { FirebaseAuthDeletion } from './firebase-auth-deletion.js';

type Row = {
    subject: string;
    lastError: string;
    attempts: number;
};

class FakeAdmin implements FirebaseAuthAdmin {
    readonly deleted: string[] = [];
    readonly lookups: string[] = [];
    deleteError: unknown = null;
    lookupError: unknown = null;
    emailUid = 'looked-up-uid';

    async deleteUser(uid: string): Promise<void> {
        this.deleted.push(uid);
        if (this.deleteError) throw this.deleteError;
    }

    async getUserByEmail(email: string): Promise<{ uid: string }> {
        this.lookups.push(email);
        if (this.lookupError) throw this.lookupError;
        return { uid: this.emailUid };
    }
}

function notFound(): Error {
    return Object.assign(new Error('no such user'), { code: 'auth/user-not-found' });
}

function internal(): Error {
    return Object.assign(new Error('auth backend failed'), { code: 'auth/internal-error' });
}

function memoryDeletion(admin: FirebaseAuthAdmin | null) {
    const rows = new Map<string, Row>();
    const deletion = new FirebaseAuthDeletion(admin);
    deletion.bindQuery(() => ({
        query: async (text: string, values: readonly unknown[] = []) => {
            if (text.includes('INSERT INTO "authCleanup"')) {
                const subject = String(values[0]);
                const error = String(values[1]);
                const existing = rows.get(subject);
                if (existing) {
                    existing.lastError = error;
                    existing.attempts += 1;
                } else {
                    rows.set(subject, { subject, lastError: error, attempts: 1 });
                }
                return { rows: [] };
            }
            if (text.includes('SELECT "subject"')) {
                return { rows: [...rows.values()] };
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

test('a stored Firebase uid is deleted, and user-not-found is success', async () => {
    const admin = new FakeAdmin();
    admin.deleteError = notFound();
    const { deletion, rows } = memoryDeletion(admin);

    try {
        const deleted = await deletion.removeForDeletedAccount(
            [{ provider: 'GOOGLE', providerData: { firebaseUid: 'firebase-uid' } }],
            'ada@example.com',
        );
        assert.equal(deleted, true);
        assert.deepEqual(admin.deleted, ['firebase-uid']);
        assert.deepEqual(admin.lookups, []);
        assert.equal(rows.size, 0);
        assert.equal(isFirebaseUserNotFound(notFound()), true);
    } finally {
        deletion.stop();
    }
});

test('any other Auth failure is queued and a later retry clears it', async () => {
    const admin = new FakeAdmin();
    admin.deleteError = internal();
    const { deletion, rows } = memoryDeletion(admin);

    try {
        const deleted = await deletion.removeForDeletedAccount(
            [{ provider: 'GOOGLE', providerData: { firebaseUid: 'firebase-uid' } }],
            'ada@example.com',
        );
        assert.equal(deleted, false);
        assert.equal(rows.get('firebase-uid')?.attempts, 1);
        assert.equal(rows.get('firebase-uid')?.lastError, 'auth backend failed');

        admin.deleteError = null;
        await deletion.retryPending();
        assert.deepEqual(admin.deleted, ['firebase-uid', 'firebase-uid']);
        assert.equal(rows.size, 0);
    } finally {
        deletion.stop();
    }
});

test('a password account does not call Firebase', async () => {
    const admin = new FakeAdmin();
    const { deletion } = memoryDeletion(admin);

    try {
        const deleted = await deletion.removeForDeletedAccount(
            [{ provider: 'EMAIL', providerData: { email: 'ada@example.com' } }],
            'ada@example.com',
        );
        assert.equal(deleted, false);
        assert.deepEqual(admin.deleted, []);
        assert.deepEqual(admin.lookups, []);
    } finally {
        deletion.stop();
    }
});

test('an older Google link is deleted by one email lookup', async () => {
    const admin = new FakeAdmin();
    const { deletion, rows } = memoryDeletion(admin);

    try {
        const deleted = await deletion.removeForDeletedAccount(
            [{ provider: 'GOOGLE', providerData: { email: 'ada@example.com' } }],
            'Ada@Example.com',
        );
        assert.equal(deleted, true);
        assert.deepEqual(admin.lookups, ['ada@example.com']);
        assert.deepEqual(admin.deleted, ['looked-up-uid']);
        assert.equal(rows.size, 0);
    } finally {
        deletion.stop();
    }
});

test('a missing email user is success, and a lookup failure is queued without the address in the log path', async () => {
    const admin = new FakeAdmin();
    admin.lookupError = notFound();
    const { deletion, rows } = memoryDeletion(admin);

    try {
        const missing = await deletion.removeForDeletedAccount(
            [{ provider: 'GOOGLE' }],
            'ada@example.com',
        );
        assert.equal(missing, false);
        assert.equal(rows.size, 0);

        admin.lookupError = internal();
        const failed = await deletion.removeForDeletedAccount(
            [{ provider: 'GOOGLE' }],
            'ada@example.com',
        );
        assert.equal(failed, false);
        const subject = emailCleanupSubject('ada@example.com');
        assert.equal(subject, 'email:ada@example.com');
        assert.equal(rows.get(subject!)?.lastError, 'auth backend failed');
        assert.deepEqual(admin.deleted, []);
    } finally {
        deletion.stop();
    }
});

test('a missing Admin client queues the uid and does not throw', async () => {
    const { deletion, rows } = memoryDeletion(null);

    try {
        const deleted = await deletion.removeForDeletedAccount(
            [{ provider: 'GOOGLE', providerData: { firebaseUid: 'firebase-uid' } }],
            'ada@example.com',
        );
        assert.equal(deleted, false);
        assert.equal(rows.get('firebase-uid')?.lastError, 'Firebase Admin is not configured');
    } finally {
        deletion.stop();
    }
});

test('deletion targets skip password accounts and dedupe stored uids', () => {
    assert.deepEqual(
        firebaseDeletionTargets(
            [
                { provider: 'EMAIL' },
                { provider: 'GOOGLE', providerData: { firebaseUid: 'uid-a' } },
                { provider: 'GOOGLE', providerData: { firebaseUid: 'uid-a' } },
                { provider: 'GOOGLE', providerData: { firebaseUid: ' email:nope ' } },
            ],
            'ada@example.com',
        ),
        { uids: ['uid-a'], lookupEmail: 'ada@example.com' },
    );
    assert.equal(emailCleanupSubject('not-an-email'), null);
});

test('production with Firebase sign-in logs when the Admin key is missing, and still has no boot error', () => {
    const message = 'FIREBASE_PROJECT_ID is set but FIREBASE_SERVICE_ACCOUNT_JSON is missing or invalid. Account deletion will not remove Firebase Auth users until it is set.';
    assert.equal(
        firebaseAdminConfigProblem({
            NODE_ENV: 'production',
            FIREBASE_PROJECT_ID: 'demo',
        }),
        message,
    );
    assert.equal(
        firebaseAdminConfigProblem({
            NODE_ENV: 'production',
            FIREBASE_PROJECT_ID: 'demo',
            FIREBASE_SERVICE_ACCOUNT_JSON: '{not-json',
        }),
        message,
    );
    assert.equal(firebaseAdminConfigProblem({ NODE_ENV: 'development', FIREBASE_PROJECT_ID: 'demo' }), null);
    assert.equal(firebaseAdminConfigProblem({ NODE_ENV: 'production' }), null);
    assert.equal(
        firebaseAdminConfigProblem({
            NODE_ENV: 'production',
            FIREBASE_PROJECT_ID: 'demo',
            FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
                client_email: 'firebase@example.iam.gserviceaccount.com',
                private_key: 'key',
            }),
        }),
        null,
    );
});
