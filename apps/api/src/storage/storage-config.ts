import { isAbsolute, join } from 'path';

import type { LocalStorageOptions } from './local-storage.js';
import type { S3StorageOptions } from './s3-storage.js';

export const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;

export type StorageConfig =
    | { driver: 'local'; local: LocalStorageOptions }
    | { driver: 's3'; s3: S3StorageOptions };

export function readStorageConfig(env: NodeJS.ProcessEnv): StorageConfig {
    const driver = (env['STORAGE_DRIVER'] ?? 'local').trim().toLowerCase();
    const ttlSeconds = readTtl(env['STORAGE_SIGNED_URL_TTL_SECONDS']);

    if (driver === 'local') {
        return {
            driver,
            local: {
                root: readLocalRoot(env['STORAGE_LOCAL_DIR']),
                signingSecret: readSigningSecret(env),
                ttlSeconds,
            },
        };
    }

    if (driver === 's3') {
        return { driver, s3: readS3(env, ttlSeconds) };
    }

    throw new Error('STORAGE_DRIVER must be "local" or "s3"');
}

function readTtl(raw: string | undefined): number {
    if (raw == null || raw.trim() === '') return DEFAULT_SIGNED_URL_TTL_SECONDS;
    const ttl = Number(raw);
    if (!Number.isInteger(ttl) || ttl < 60 || ttl > 86_400) {
        throw new Error('STORAGE_SIGNED_URL_TTL_SECONDS must be an integer from 60 to 86400');
    }
    return ttl;
}

function readSigningSecret(env: NodeJS.ProcessEnv): string {
    const secret = env['STORAGE_SIGNING_SECRET']?.trim() || env['JWT_ACCESS_SECRET']?.trim();
    if (!secret || secret.length < 16) {
        throw new Error(
            'Local storage needs STORAGE_SIGNING_SECRET or JWT_ACCESS_SECRET (at least 16 characters) to sign download URLs',
        );
    }
    return secret;
}

function readLocalRoot(raw: string | undefined): string {
    const dir = raw?.trim() || 'uploads';
    if (dir.split(/[/\\]/).includes('..')) {
        throw new Error('STORAGE_LOCAL_DIR must not contain ".."');
    }
    return isAbsolute(dir) ? dir : join(process.cwd(), dir);
}

function readS3(env: NodeJS.ProcessEnv, ttlSeconds: number): S3StorageOptions {
    return {
        endpoint: readEndpoint(required(env, 'S3_ENDPOINT')),
        region: required(env, 'S3_REGION'),
        bucket: readBucket(required(env, 'S3_BUCKET')),
        accessKeyId: required(env, 'S3_ACCESS_KEY_ID'),
        secretAccessKey: required(env, 'S3_SECRET_ACCESS_KEY'),
        forcePathStyle: readFlag(env['S3_FORCE_PATH_STYLE'], true),
        ttlSeconds,
    };
}

function required(env: NodeJS.ProcessEnv, name: string): string {
    const value = env[name]?.trim();
    if (!value) throw new Error(`${name} is required when STORAGE_DRIVER=s3`);
    return value;
}

function readEndpoint(value: string): string {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error('S3_ENDPOINT must be an http(s) URL');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('S3_ENDPOINT must be an http(s) URL');
    }
    return value.replace(/\/+$/, '');
}

function readBucket(value: string): string {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,62}$/.test(value)) {
        throw new Error('S3_BUCKET must be a bucket name without slashes');
    }
    return value;
}

function readFlag(raw: string | undefined, fallback: boolean): boolean {
    if (raw == null || raw.trim() === '') return fallback;
    const value = raw.trim().toLowerCase();
    if (value === '1' || value === 'true' || value === 'yes') return true;
    if (value === '0' || value === 'false' || value === 'no') return false;
    throw new Error('S3_FORCE_PATH_STYLE must be true or false');
}
