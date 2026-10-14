import assert from 'node:assert/strict';
import test from 'node:test';

import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service.js';

const firebaseClaims = {
    iss: 'https://securetoken.google.com/my-app',
    sub: 'firebase-uid',
    email: 'ana@example.com',
    email_verified: true,
    name: 'Ana',
    firebase: {
        sign_in_provider: 'google.com',
        identities: { 'google.com': ['1234567890'] },
    },
};

function authDb(seed: {
    user?: Record<string, unknown> | null;
    account?: Record<string, unknown> | null;
} = {}) {
    const created: Record<string, unknown>[] = [];
    const updates: Record<string, unknown>[] = [];
    const client = {
        orm: {
            public: {
                User: {
                    where(query: { email?: string }) {
                        return {
                            async first() {
                                if (query.email && seed.user?.email !== query.email) return null;
                                return seed.user ?? null;
                            },
                            async update(data: Record<string, unknown>) {
                                updates.push(data);
                                seed.user = { ...seed.user, ...data };
                                return seed.user;
                            },
                        };
                    },
                    async create(data: Record<string, unknown>) {
                        const row = {
                            id: 4,
                            status: 'ACTIVE',
                            createdAt: new Date(),
                            ...data,
                        };
                        created.push(row);
                        return row;
                    },
                },
                Account: {
                    where() {
                        return { async first() { return seed.account ?? null; } };
                    },
                    async create() {
                        return { id: 8 };
                    },
                    whereUpdate() {
                        return undefined;
                    },
                },
                Session: {
                    async create() {
                        return { id: 9 };
                    },
                    where() {
                        return { async update() { return {}; } };
                    },
                },
            },
        },
    };
    const account = client.orm.public.Account as {
        where: () => { first: () => Promise<unknown>; update?: (data: unknown) => Promise<unknown> };
    };
    account.where = () => ({
        async first() {
            return seed.account ?? null;
        },
        async update() {
            return {};
        },
    });
    return { client, created, updates };
}

function service(client: unknown, verify: () => Promise<unknown> = async () => firebaseClaims) {
    return new AuthService(
        { client } as never,
        { signAsync: async () => 'token' } as never,
        {} as never,
        { verify } as never,
    );
}

test('register and login put ageConfirmedAt on the user', async () => {
    const registered = authDb();
    const created = await service(registered.client).register({
        email: 'Ana@Example.com',
        password: 'password1',
        displayName: 'Ana',
        ageConfirmed: true,
    });
    assert.equal(registered.created[0]?.ageConfirmedAt, created.user.ageConfirmedAt);
    assert.match(String(created.user.ageConfirmedAt), /^\d{4}-\d{2}-\d{2}T/);
    assert.equal('dateOfBirth' in created.user, false);

    const omitted = authDb();
    const plain = await service(omitted.client).register({
        email: 'Ana@Example.com',
        password: 'password1',
        displayName: 'Ana',
    });
    assert.equal(plain.user.ageConfirmedAt, null);
    assert.equal('ageConfirmedAt' in (omitted.created[0] ?? {}), false);

    const passwordHash = await bcrypt.hash('password1', 4);
    const loginDb = authDb({
        user: {
            id: 4,
            email: 'ana@example.com',
            displayName: 'Ana',
            passwordHash,
            status: 'ACTIVE',
            ageConfirmedAt: created.user.ageConfirmedAt,
        },
    });
    const signedIn = await service(loginDb.client).login({
        email: 'ana@example.com',
        password: 'password1',
    });
    assert.equal(signedIn.user.ageConfirmedAt, created.user.ageConfirmedAt);
});

test('Google sign-in stores the first attestation and leaves a later one alone', async () => {
    const createdDb = authDb();
    const created = await service(createdDb.client).googleLogin('token', true);
    assert.equal(createdDb.created[0]?.ageConfirmedAt, created.user.ageConfirmedAt);
    assert.match(String(created.user.ageConfirmedAt), /^\d{4}-\d{2}-\d{2}T/);

    const existing = authDb({
        account: { id: 2, userId: 4, providerData: { firebaseUid: 'firebase-uid' } },
        user: {
            id: 4,
            email: 'ana@example.com',
            displayName: 'Ana',
            status: 'ACTIVE',
            ageConfirmedAt: '2026-01-01T00:00:00.000Z',
        },
    });
    const again = await service(existing.client).googleLogin('token', true);
    assert.equal(again.user.ageConfirmedAt, '2026-01-01T00:00:00.000Z');
    assert.deepEqual(existing.updates, []);

    const unset = authDb({
        account: { id: 2, userId: 4, providerData: {} },
        user: {
            id: 4,
            email: 'ana@example.com',
            displayName: 'Ana',
            status: 'ACTIVE',
            ageConfirmedAt: null,
        },
    });
    const filled = await service(unset.client).googleLogin('token', true);
    assert.equal(filled.user.ageConfirmedAt, unset.updates[0]?.ageConfirmedAt);
    assert.match(String(filled.user.ageConfirmedAt), /^\d{4}-\d{2}-\d{2}T/);
});
