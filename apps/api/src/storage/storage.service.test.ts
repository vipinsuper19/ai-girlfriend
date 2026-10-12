import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';

import type { ObjectStorage } from './object-storage.js';
import { StorageService } from './storage.service.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);

class MemoryStorage implements ObjectStorage {
    readonly deleted: string[] = [];
    readonly prefixes: string[] = [];
    readonly puts: { key: string; bytes: number; contentType: string }[] = [];
    failPrefix: string | null = null;
    failKey: string | null = null;
    failList = false;

    async put(key: string, body: Buffer, contentType: string): Promise<void> {
        this.puts.push({ key, bytes: body.length, contentType });
    }

    async delete(key: string): Promise<void> {
        if (key === this.failKey) throw new Error('portrait denied');
        this.deleted.push(key);
    }

    async deletePrefix(prefix: string): Promise<void> {
        this.prefixes.push(prefix);
        if (prefix === this.failPrefix) throw new Error('voice bucket down');
    }

    async list(): Promise<string[]> {
        if (this.failList) throw new Error('list failed');
        return ['companions/4-a.png', 'companions/9-b.png', 'companions/5-c.jpg', 'companions/nope.txt'];
    }

    async signedUrl(key: string): Promise<string> {
        return `https://files.example/${key}?exp=soon`;
    }
}

test('account deletion deletes her folders and only her portraits', async () => {
    const memory = new MemoryStorage();
    const storage = new StorageService(memory);

    const removal = await storage.removeUserFiles(3, [4, 5]);

    assert.deepEqual(memory.prefixes, ['voice/3/', 'images/3/']);
    assert.deepEqual(memory.deleted, ['companions/4-a.png', 'companions/5-c.jpg']);
    assert.deepEqual(removal, { failures: [], incomplete: false });
});

test('a failed object delete is reported and the rest of the account is still removed', async () => {
    const memory = new MemoryStorage();
    memory.failPrefix = 'voice/3/';
    memory.failKey = 'companions/4-a.png';
    const storage = new StorageService(memory);

    const removal = await storage.removeUserFiles(3, [4, 5]);

    assert.deepEqual(memory.prefixes, ['voice/3/', 'images/3/']);
    assert.deepEqual(memory.deleted, ['companions/5-c.jpg']);
    assert.equal(removal.incomplete, false);
    assert.deepEqual(removal.failures, [
        { key: 'voice/3/', error: 'voice bucket down' },
        { key: 'companions/4-a.png', error: 'portrait denied' },
    ]);
});

test('a failed portrait listing is incomplete and does not queue the shared directory', async () => {
    const memory = new MemoryStorage();
    memory.failList = true;
    const storage = new StorageService(memory);

    const removal = await storage.removeUserFiles(3, [4, 5]);

    assert.deepEqual(memory.prefixes, ['voice/3/', 'images/3/']);
    assert.deepEqual(memory.deleted, []);
    assert.equal(removal.incomplete, true);
    assert.deepEqual(removal.failures, []);
});

test('avatar and generated image uploads follow the file signature, not the declared type', async () => {
    const memory = new MemoryStorage();
    const storage = new StorageService(memory);

    const avatar = await storage.saveCompanionAvatar(4, {
        buffer: PNG,
        mimetype: 'text/html',
        originalname: 'avatar.html',
    } as Express.Multer.File);
    const image = await storage.saveGeneratedImage(3, JPEG, 'image/png');

    assert.match(avatar, /^\/uploads\/companions\/4-[0-9a-f-]+\.png$/);
    assert.match(image, /^\/uploads\/images\/3\/[0-9a-f-]+\.jpg$/);
    assert.equal(memory.puts[0]?.contentType, 'image/png');
    assert.equal(memory.puts[1]?.contentType, 'image/jpeg');

    await assert.rejects(
        () => storage.saveCompanionAvatar(4, {
            buffer: Buffer.from('<html></html>'),
            mimetype: 'image/png',
            originalname: 'avatar.png',
        } as Express.Multer.File),
        (error: unknown) => error instanceof BadRequestException,
    );
    await assert.rejects(
        () => storage.saveGeneratedImage(3, Buffer.from('GIF89a'), 'image/gif'),
        (error: unknown) => error instanceof BadRequestException,
    );
    assert.equal(memory.puts.length, 2);
});

test('a single voice note or gallery image is deleted by its stored url', async () => {
    const memory = new MemoryStorage();
    const storage = new StorageService(memory);
    const voice = '/uploads/voice/3/0f8e2a6c-1d2b-4c3d-9e8f-123456789abc.m4a?exp=1&sig=abc';

    await storage.removeVoiceFile(3, voice);
    await storage.removeVoiceFile(4, voice);
    await storage.removeImageFile(
        3,
        'https://abc.storage.supabase.co/storage/v1/s3/media/images/3/0f8e2a6c-1d2b-4c3d-9e8f-123456789abc.png?X-Amz-Signature=abc',
    );

    assert.deepEqual(memory.deleted, [
        'voice/3/0f8e2a6c-1d2b-4c3d-9e8f-123456789abc.m4a',
        'images/3/0f8e2a6c-1d2b-4c3d-9e8f-123456789abc.png',
    ]);
});

test('responses sign file urls and leave the rest of the payload alone', async () => {
    const storage = new StorageService(new MemoryStorage());
    const body = await storage.signFileUrls({
        content: 'see /uploads/voice/3/secret.wav',
        audioUrl: '/uploads/voice/3/0f8e2a6c-1d2b-4c3d-9e8f-123456789abc.wav',
        imageUrl: null,
        appearance: {
            avatarUrl: '/uploads/companions/4-0f8e2a6c-1d2b-4c3d-9e8f-123456789abc.png',
            hairColor: 'Black',
        },
        messages: [
            { imageUrl: 'https://cdn.example/already.png' },
            { audioUrl: 'https://cdn.example/voice/3/0f8e2a6c-1d2b-4c3d-9e8f-123456789abc.wav' },
        ],
    });

    assert.equal(body.content, 'see /uploads/voice/3/secret.wav');
    assert.equal(
        body.audioUrl,
        'https://files.example/voice/3/0f8e2a6c-1d2b-4c3d-9e8f-123456789abc.wav?exp=soon',
    );
    assert.equal(body.imageUrl, null);
    assert.equal(
        body.appearance.avatarUrl,
        'https://files.example/companions/4-0f8e2a6c-1d2b-4c3d-9e8f-123456789abc.png?exp=soon',
    );
    assert.equal(body.appearance.hairColor, 'Black');
    assert.equal(body.messages[0]?.imageUrl, 'https://cdn.example/already.png');
    assert.equal(
        body.messages[1]?.audioUrl,
        'https://cdn.example/voice/3/0f8e2a6c-1d2b-4c3d-9e8f-123456789abc.wav',
    );
});
