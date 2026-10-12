import assert from 'node:assert/strict';
import test from 'node:test';

import { PrismaService } from '../prisma/prisma.service.js';
import {
    MemoryDeletionRequestStore,
    PrismaDeletionRequestStore,
    deleteDeletionRequestsForEmail,
    deletionRequestCutoff,
} from './deletion-request.store.js';

test('the deletion store keeps a request and drops one older than 30 days', async () => {
    const store = new MemoryDeletionRequestStore(30 * 24 * 60 * 60 * 1000);
    const now = new Date('2026-10-12T00:00:00.000Z');
    await store.save({
        email: 'old@example.com',
        note: '',
        tokenHash: 'old',
        createdAt: '2026-09-01T00:00:00.000Z',
    }, now);
    await store.save({
        email: 'new@example.com',
        note: 'please delete',
        tokenHash: 'new',
        createdAt: '2026-10-12T00:00:00.000Z',
    }, now);

    assert.deepEqual(store.saved.map((row) => row.email), ['new@example.com']);
    const missing = await store.confirm('old', now);
    assert.equal(missing.status, 'missing');
    const confirmed = await store.confirm('new', now);
    assert.equal(confirmed.status, 'confirmed');
    if (confirmed.status === 'confirmed') {
        assert.equal(confirmed.email, 'new@example.com');
        assert.equal(confirmed.note, 'please delete');
    }
});

test('postgres prune deletes rows older than the retention cutoff', async () => {
    const now = new Date('2026-10-12T00:00:00.000Z');
    let cutoff = '';
    let deleted = false;
    const table = {
        create: async () => {
            throw new Error('create is not part of prune');
        },
        where(filter: unknown) {
            if (typeof filter === 'function') {
                const row = {
                    createdAt: {
                        lt(value: string) {
                            cutoff = value;
                            return { op: 'lt', value };
                        },
                    },
                };
                filter(row);
            }
            return {
                first: async () => null,
                update: async () => undefined,
                deleteAndCount: async () => {
                    deleted = true;
                    return 1;
                },
            };
        },
    };
    const prisma = {
        client: { orm: { public: { DeletionRequest: table } } },
    } as unknown as PrismaService;
    const store = new PrismaDeletionRequestStore(prisma);

    const removed = await store.prune(now);
    assert.equal(removed, 1);
    assert.equal(deleted, true);
    assert.equal(cutoff, deletionRequestCutoff(now));
    assert.equal(cutoff, '2026-09-12T00:00:00.000Z');
});

test('account deletion deletes requests stored for that email', async () => {
    let seen = '';
    const client = {
        orm: {
            public: {
                DeletionRequest: {
                    where(filter: { email?: string }) {
                        seen = filter.email ?? '';
                        return {
                            deleteAndCount: async () => 2,
                        };
                    },
                },
            },
        },
    };

    assert.equal(await deleteDeletionRequestsForEmail(client, ' User@Example.com '), 2);
    assert.equal(seen, 'user@example.com');
    assert.equal(await deleteDeletionRequestsForEmail(client, 'not-an-email'), 0);
    assert.equal(await deleteDeletionRequestsForEmail(client, null), 0);
});
