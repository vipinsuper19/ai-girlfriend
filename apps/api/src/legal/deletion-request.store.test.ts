import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { FileDeletionRequestStore } from './deletion-request.store.js';

test('the deletion log keeps a request and drops one older than 30 days', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'deletion-'));
    const store = new FileDeletionRequestStore(join(dir, 'requests.jsonl'), 30 * 24 * 60 * 60 * 1000);
    const now = new Date('2026-10-12T00:00:00.000Z');
    await store.save({
        email: 'old@example.com',
        note: '',
        createdAt: '2026-09-01T00:00:00.000Z',
    }, now);
    await store.save({
        email: 'new@example.com',
        note: 'please delete',
        createdAt: '2026-10-12T00:00:00.000Z',
    }, now);

    const rows = await store.read();
    assert.deepEqual(rows.map((row) => row.email), ['new@example.com']);
    const raw = await readFile(join(dir, 'requests.jsonl'), 'utf8');
    assert.match(raw, /new@example.com/);
    assert.doesNotMatch(raw, /old@example.com/);
});
