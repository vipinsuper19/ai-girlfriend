import assert from 'node:assert/strict';
import test from 'node:test';

import type { ObjectStorage } from './object-storage.js';
import { StorageService } from './storage.service.js';

class MemoryStorage implements ObjectStorage {
    readonly deleted: string[] = [];
    readonly prefixes: string[] = [];
    readonly puts: { key: string; bytes: number; contentType: string }[] = [];

    async put(key: string, body: Buffer, contentType: string): Promise<void> {
        this.puts.push({ key, bytes: body.length, contentType });
    }

    async delete(key: string): Promise<void> {
        this.deleted.push(key);
    }

    async deletePrefix(prefix: string): Promise<void> {
        this.prefixes.push(prefix);
    }

    async list(): Promise<string[]> {
        return ['companions/4-a.png', 'companions/9-b.png', 'companions/5-c.jpg', 'companions/nope.txt'];
    }

    async signedUrl(key: string): Promise<string> {
        return `https://files.example/${key}?exp=soon`;
    }
}

test('account deletion deletes her folders and only her portraits', async () => {
    const memory = new MemoryStorage();
    const storage = new StorageService(memory);

    await storage.removeUserFiles(3, [4, 5]);

    assert.deepEqual(memory.prefixes, ['voice/3/', 'images/3/']);
    assert.deepEqual(memory.deleted, ['companions/4-a.png', 'companions/5-c.jpg']);
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
