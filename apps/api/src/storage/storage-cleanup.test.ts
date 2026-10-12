import assert from 'node:assert/strict';
import test from 'node:test';

import type { ObjectStorage } from './object-storage.js';
import { StorageCleanup } from './storage-cleanup.js';

type Row = {
    object_key: string;
    last_error: string;
    attempts: number;
};

class MemoryObjects implements ObjectStorage {
    readonly deleted: string[] = [];
    readonly prefixes: string[] = [];
    failKey: string | null = null;

    async put(): Promise<void> {
        return undefined;
    }

    async delete(key: string): Promise<void> {
        if (key === this.failKey) throw new Error('still denied');
        this.deleted.push(key);
    }

    async deletePrefix(prefix: string): Promise<void> {
        this.prefixes.push(prefix);
    }

    async list(): Promise<string[]> {
        return [];
    }

    async signedUrl(key: string): Promise<string> {
        return key;
    }
}

function memoryCleanup(objects: ObjectStorage) {
    const rows = new Map<string, Row>();
    const cleanup = new StorageCleanup(objects);
    cleanup.bindQuery(() => ({
        query: async (text: string, values: readonly unknown[] = []) => {
            if (text.includes('CREATE TABLE')) return { rows: [] };
            if (text.includes('INSERT INTO storage_cleanup')) {
                const key = String(values[0]);
                const error = String(values[1]);
                const existing = rows.get(key);
                if (existing) {
                    existing.last_error = error;
                    existing.attempts += 1;
                } else {
                    rows.set(key, { object_key: key, last_error: error, attempts: 1 });
                }
                return { rows: [] };
            }
            if (text.includes('SELECT object_key')) {
                return { rows: [...rows.values()] };
            }
            if (text.startsWith('DELETE')) {
                rows.delete(String(values[0]));
                return { rows: [] };
            }
            if (text.includes('UPDATE storage_cleanup')) {
                const row = rows.get(String(values[0]));
                if (row) {
                    row.attempts += 1;
                    row.last_error = String(values[1]);
                }
                return { rows: [] };
            }
            throw new Error(`unexpected sql: ${text}`);
        },
    }));
    return { cleanup, rows };
}

test('a failed delete is queued and a later retry removes it', async () => {
    const objects = new MemoryObjects();
    const { cleanup, rows } = memoryCleanup(objects);

    try {
        await cleanup.record([
            { key: 'voice/3/', error: 'timeout' },
            { key: 'companions/4-a.png', error: 'denied' },
        ]);
        assert.equal(rows.size, 2);

        await cleanup.retryPending();

        assert.deepEqual(objects.prefixes, ['voice/3/']);
        assert.deepEqual(objects.deleted, ['companions/4-a.png']);
        assert.equal(rows.size, 0);
    } finally {
        cleanup.stop();
    }
});

test('a retry that fails again stays in the cleanup table', async () => {
    const objects = new MemoryObjects();
    objects.failKey = 'companions/4-a.png';
    const { cleanup, rows } = memoryCleanup(objects);

    try {
        await cleanup.record([{ key: 'companions/4-a.png', error: 'denied' }]);
        await cleanup.retryPending();

        assert.deepEqual(objects.deleted, []);
        assert.equal(rows.get('companions/4-a.png')?.attempts, 2);
        assert.equal(rows.get('companions/4-a.png')?.last_error, 'still denied');
    } finally {
        cleanup.stop();
    }
});

test('the shared portrait directory is not queued for retry', async () => {
    const { cleanup } = memoryCleanup(new MemoryObjects());

    try {
        await assert.rejects(
            () => cleanup.record([{ key: 'companions/', error: 'nope' }]),
            /cannot be retried safely/,
        );
    } finally {
        cleanup.stop();
    }
});
