import assert from 'node:assert/strict';
import test from 'node:test';

import {
    DeleteObjectCommand,
    DeleteObjectsCommand,
    ListObjectsV2Command,
    PutObjectCommand,
} from '@aws-sdk/client-s3';

import { S3ObjectStorage, type S3Sender, s3ClientConfig } from './s3-storage.js';

const options = {
    endpoint: 'https://abc.storage.supabase.co/storage/v1/s3',
    region: 'ap-southeast-1',
    bucket: 'media',
    accessKeyId: 'access-key',
    secretAccessKey: 'secret-key',
    forcePathStyle: true,
    ttlSeconds: 120,
};

test('presigned urls target the configured endpoint and expire with the ttl', async () => {
    const storage = new S3ObjectStorage(options);
    const url = new URL(await storage.signedUrl('voice/3/note.wav'));

    assert.equal(url.origin, 'https://abc.storage.supabase.co');
    assert.equal(url.pathname, '/storage/v1/s3/media/voice/3/note.wav');
    assert.equal(url.searchParams.get('X-Amz-Expires'), '120');
    assert.ok(url.searchParams.get('X-Amz-Signature'));
    assert.equal(url.searchParams.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256');
    assert.equal(url.searchParams.has('x-amz-acl'), false);
    assert.equal(url.searchParams.has('X-Amz-Credential'), true);
});

test('puts and deletes stay private and prefix deletes page through the bucket', async () => {
    const sent: unknown[] = [];
    let listCalls = 0;
    const client: S3Sender = {
        async send(command: unknown) {
            sent.push(command);
            if (command instanceof ListObjectsV2Command) {
                listCalls += 1;
                if (listCalls % 2 === 1) {
                    return {
                        Contents: [{ Key: 'voice/3/a.wav' }, { Key: 'voice/3/not a key' }],
                        IsTruncated: true,
                        NextContinuationToken: 'next',
                    };
                }
                return {
                    Contents: [{ Key: 'voice/3/b.wav' }],
                    IsTruncated: false,
                };
            }
            if (command instanceof DeleteObjectsCommand) {
                return { Errors: [] };
            }
            return {};
        },
    };
    const storage = new S3ObjectStorage(options, client);

    await storage.put('images/3/pic.png', Buffer.from('png'), 'image/png');
    const put = sent.find((command) => command instanceof PutObjectCommand) as PutObjectCommand;
    assert.equal(put.input.Bucket, 'media');
    assert.equal(put.input.Key, 'images/3/pic.png');
    assert.equal(put.input.ContentType, 'image/png');
    assert.equal(put.input.ACL, undefined);
    assert.match(put.input.CacheControl ?? '', /^private,/);

    await storage.delete('images/3/pic.png');
    const removed = sent.find((command) => command instanceof DeleteObjectCommand) as DeleteObjectCommand;
    assert.equal(removed.input.Key, 'images/3/pic.png');

    const keys = await storage.list('voice/3/');
    assert.deepEqual(keys, ['voice/3/a.wav', 'voice/3/b.wav']);
    await storage.deletePrefix('voice/3/');
    const batch = sent.filter((command) => command instanceof DeleteObjectsCommand) as DeleteObjectsCommand[];
    assert.equal(batch.length, 1);
    assert.deepEqual(
        batch[0]?.input.Delete?.Objects?.map((item) => item.Key),
        ['voice/3/a.wav', 'voice/3/b.wav'],
    );
});

test('the client config keeps checksums off unless the store requires them', () => {
    const config = s3ClientConfig(options);
    assert.equal(config.forcePathStyle, true);
    assert.equal(config.endpoint, options.endpoint);
    assert.equal(config.region, options.region);
    assert.equal(config.requestChecksumCalculation, 'WHEN_REQUIRED');
    assert.equal(config.responseChecksumValidation, 'WHEN_REQUIRED');
});
