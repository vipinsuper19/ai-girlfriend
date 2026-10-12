import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import type { Request, Response } from 'express';

import { createLocalDownloadHandler, LocalObjectStorage } from './local-storage.js';

test('local files are private and served only with a live signature', async () => {
    const root = await mkdtemp(join(tmpdir(), 'uploads-'));
    let now = 1_700_000_000_000;
    const storage = new LocalObjectStorage({
        root,
        signingSecret: 'test-secret-value',
        ttlSeconds: 60,
        now: () => now,
    });
    const server = createServer((req, res) => {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        req.url = `${url.pathname.slice('/uploads'.length)}${url.search}`;
        createLocalDownloadHandler(storage)(req as Request, res as unknown as Response, () => {
            res.statusCode = 500;
            res.end();
        });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const origin = `http://127.0.0.1:${port}`;

    try {
        await storage.put('voice/3/note.wav', Buffer.from('RIFF-MORE'), 'audio/wav');
        await storage.put('images/3/pic.png', Buffer.from('png'), 'image/png');
        const url = await storage.signedUrl('voice/3/note.wav');
        assert.match(url, /^\/uploads\/voice\/3\/note\.wav\?exp=1700000060&sig=[A-Za-z0-9_-]+$/);

        const ok = await fetch(`${origin}${url}`);
        assert.equal(ok.status, 200);
        assert.equal(ok.headers.get('content-type'), 'audio/wav');
        assert.match(ok.headers.get('cache-control') ?? '', /private/);
        assert.equal(Buffer.from(await ok.arrayBuffer()).toString(), 'RIFF-MORE');

        const ranged = await fetch(`${origin}${url}`, { headers: { Range: 'bytes=0-3' } });
        assert.equal(ranged.status, 206);
        assert.equal(Buffer.from(await ranged.arrayBuffer()).toString(), 'RIFF');

        const open = await fetch(`${origin}/uploads/voice/3/note.wav`);
        assert.equal(open.status, 403);

        const escaped = await fetch(`${origin}/uploads/voice/3/../../images/3/pic.png?exp=1&sig=abc`);
        assert.equal(escaped.status, 403);

        const tampered = await fetch(`${origin}${url.replace(/sig=[^&]+/, 'sig=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')}`);
        assert.equal(tampered.status, 403);

        now += 61_000;
        const expired = await fetch(`${origin}${url}`);
        assert.equal(expired.status, 403);
        now -= 61_000;

        await storage.delete('voice/3/note.wav');
        const missing = await fetch(`${origin}${url}`);
        assert.equal(missing.status, 404);

        await storage.deletePrefix('images/3/');
        assert.deepEqual(await storage.list('images/3/'), []);
        await storage.put('companions/4-abc.png', Buffer.from('a'), 'image/png');
        await storage.put('companions/9-def.png', Buffer.from('b'), 'image/png');
        assert.deepEqual(
            (await storage.list('companions/')).sort(),
            ['companions/4-abc.png', 'companions/9-def.png'],
        );
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
        await rm(root, { recursive: true, force: true });
    }
});
