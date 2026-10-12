import assert from 'node:assert/strict';
import test from 'node:test';

import { readStorageConfig } from './storage-config.js';

const secret = 'local-signing-secret';

test('local is the default driver', () => {
    const config = readStorageConfig({ JWT_ACCESS_SECRET: secret });
    assert.equal(config.driver, 'local');
    if (config.driver !== 'local') return;
    assert.equal(config.local.ttlSeconds, 3600);
    assert.equal(config.local.signingSecret, secret);
    assert.equal(config.local.root.endsWith('/uploads'), true);
});

test('STORAGE_SIGNING_SECRET overrides the access-token secret', () => {
    const config = readStorageConfig({
        STORAGE_SIGNING_SECRET: 'dedicated-secret',
        JWT_ACCESS_SECRET: secret,
        STORAGE_SIGNED_URL_TTL_SECONDS: '900',
        STORAGE_LOCAL_DIR: '/tmp/media',
    });
    assert.equal(config.driver, 'local');
    if (config.driver !== 'local') return;
    assert.equal(config.local.signingSecret, 'dedicated-secret');
    assert.equal(config.local.ttlSeconds, 900);
    assert.equal(config.local.root, '/tmp/media');
});

test('a bad ttl is rejected', () => {
    assert.throws(
        () => readStorageConfig({
            JWT_ACCESS_SECRET: secret,
            STORAGE_SIGNED_URL_TTL_SECONDS: '10',
        }),
        /STORAGE_SIGNED_URL_TTL_SECONDS/,
    );
});

test('s3 config is generic endpoint, region, bucket, keys, and path style', () => {
    const config = readStorageConfig({
        STORAGE_DRIVER: 's3',
        S3_ENDPOINT: 'https://abc.storage.supabase.co/storage/v1/s3/',
        S3_REGION: 'ap-southeast-1',
        S3_BUCKET: 'media',
        S3_ACCESS_KEY_ID: 'key',
        S3_SECRET_ACCESS_KEY: 'secret',
    });
    assert.equal(config.driver, 's3');
    if (config.driver !== 's3') return;
    assert.equal(config.s3.endpoint, 'https://abc.storage.supabase.co/storage/v1/s3');
    assert.equal(config.s3.region, 'ap-southeast-1');
    assert.equal(config.s3.bucket, 'media');
    assert.equal(config.s3.accessKeyId, 'key');
    assert.equal(config.s3.secretAccessKey, 'secret');
    assert.equal(config.s3.forcePathStyle, true);
    assert.equal(config.s3.ttlSeconds, 3600);
});

test('S3_FORCE_PATH_STYLE can be turned off for AWS', () => {
    const config = readStorageConfig({
        STORAGE_DRIVER: 's3',
        S3_ENDPOINT: 'https://s3.us-east-1.amazonaws.com',
        S3_REGION: 'us-east-1',
        S3_BUCKET: 'media',
        S3_ACCESS_KEY_ID: 'key',
        S3_SECRET_ACCESS_KEY: 'secret',
        S3_FORCE_PATH_STYLE: 'false',
    });
    if (config.driver !== 's3') throw new Error('expected s3');
    assert.equal(config.s3.forcePathStyle, false);
});

test('s3 mode refuses to start without a bucket', () => {
    assert.throws(
        () => readStorageConfig({ STORAGE_DRIVER: 's3', S3_ENDPOINT: 'http://localhost:9000' }),
        /S3_REGION is required/,
    );
});
