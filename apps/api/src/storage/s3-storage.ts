import {
    DeleteObjectCommand,
    DeleteObjectsCommand,
    GetObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
    type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { isObjectKey, isObjectPrefix } from './object-key.js';
import type { ObjectStorage } from './object-storage.js';

export interface S3StorageOptions {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
    ttlSeconds: number;
}

/**
 * Minimal client surface so tests can stand in for the network calls.
 * Signing still uses a real S3Client, which does not contact the endpoint.
 */
export interface S3Sender {
    send(command: unknown): Promise<unknown>;
}

const PAGE_SIZE = 1000;

export class S3ObjectStorage implements ObjectStorage {
    private readonly bucket: string;
    readonly ttlSeconds: number;
    private readonly client: S3Client | S3Sender;

    constructor(options: S3StorageOptions, client?: S3Sender) {
        this.bucket = options.bucket;
        this.ttlSeconds = options.ttlSeconds;
        this.client = client ?? new S3Client(s3ClientConfig(options));
    }

    async put(key: string, body: Buffer, contentType: string): Promise<void> {
        assertKey(key);
        await this.client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
            CacheControl: `private, max-age=${this.ttlSeconds}`,
        }));
    }

    async delete(key: string): Promise<void> {
        assertKey(key);
        await this.client.send(new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        }));
    }

    async deletePrefix(prefix: string): Promise<void> {
        assertPrefix(prefix);
        const keys = await this.list(prefix);
        for (let index = 0; index < keys.length; index += PAGE_SIZE) {
            const chunk = keys.slice(index, index + PAGE_SIZE);
            const result = await this.client.send(new DeleteObjectsCommand({
                Bucket: this.bucket,
                Delete: { Objects: chunk.map((Key) => ({ Key })) },
            })) as { Errors?: unknown[] };
            if (result.Errors?.length) {
                throw new Error('Failed to delete stored objects');
            }
        }
    }

    async list(prefix: string): Promise<string[]> {
        assertPrefix(prefix);
        const keys: string[] = [];
        let token: string | undefined;
        do {
            const page = await this.client.send(new ListObjectsV2Command({
                Bucket: this.bucket,
                Prefix: prefix.endsWith('/') ? prefix : `${prefix}/`,
                ContinuationToken: token,
            })) as {
                Contents?: { Key?: string }[];
                IsTruncated?: boolean;
                NextContinuationToken?: string;
            };
            for (const item of page.Contents ?? []) {
                if (item.Key && isObjectKey(item.Key)) keys.push(item.Key);
            }
            token = page.IsTruncated ? page.NextContinuationToken : undefined;
        } while (token);
        return keys;
    }

    async signedUrl(key: string): Promise<string> {
        assertKey(key);
        return getSignedUrl(
            this.client as S3Client,
            new GetObjectCommand({ Bucket: this.bucket, Key: key }),
            { expiresIn: this.ttlSeconds },
        );
    }
}

export function s3ClientConfig(options: S3StorageOptions): S3ClientConfig {
    return {
        endpoint: options.endpoint,
        region: options.region,
        forcePathStyle: options.forcePathStyle,
        credentials: {
            accessKeyId: options.accessKeyId,
            secretAccessKey: options.secretAccessKey,
        },
        // Compatible stores (Supabase, MinIO, B2) reject the default checksum headers.
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
    };
}

function assertKey(key: string): void {
    if (!isObjectKey(key)) throw new Error('Invalid storage key');
}

function assertPrefix(prefix: string): void {
    if (!isObjectPrefix(prefix)) throw new Error('Invalid storage prefix');
}
