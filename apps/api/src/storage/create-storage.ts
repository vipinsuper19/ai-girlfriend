import { LocalObjectStorage } from './local-storage.js';
import type { ObjectStorage } from './object-storage.js';
import { S3ObjectStorage } from './s3-storage.js';
import { readStorageConfig } from './storage-config.js';

export function createObjectStorage(env: NodeJS.ProcessEnv = process.env): ObjectStorage {
    const config = readStorageConfig(env);
    if (config.driver === 'local') return new LocalObjectStorage(config.local);
    return new S3ObjectStorage(config.s3);
}
