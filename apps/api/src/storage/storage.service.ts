import {
    BadRequestException,
    Inject,
    Injectable,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import type { RequestHandler } from 'express';

import {
    companionFilesIn,
    ownUserFile,
    ownVoiceFile,
} from './file-types.js';
import { contentTypeForKey } from './content-type.js';
import { extensionForImageKind, imageKindFromBytes } from './image-signature.js';
import { createLocalDownloadHandler, LocalObjectStorage } from './local-storage.js';
import { isObjectKey, objectKeyFromReference, storedPath } from './object-key.js';
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage.js';
import { signFileUrlFields } from './sign-file-urls.js';
import type { StorageRemoval } from '../users/account-deletion.js';

export interface StorageSaveOptions {
    directory: string;
    fileName?: string;
    extension?: string;
}

@Injectable()
export class StorageService {
    private readonly logger = new Logger(StorageService.name);

    constructor(
        @Inject(OBJECT_STORAGE)
        private readonly objects: ObjectStorage,
    ) {}

    /**
     * Stores the bytes and returns the stable `/uploads/...` path.
     * Responses replace that path with a signed URL; the database keeps this one.
     */
    async save(file: Buffer, options: StorageSaveOptions): Promise<string> {
        try {
            if (!file?.length) throw new Error('File is empty');

            const extension = options.extension ?? '';
            const fileName = options.fileName ?? `${randomUUID()}${extension}`;
            const key = `${options.directory}/${fileName}`;
            if (!isObjectKey(key)) {
                throw new Error('Invalid storage key');
            }

            await this.objects.put(key, file, contentTypeForKey(key));
            return storedPath(key);
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            throw new InternalServerErrorException('Failed to save file');
        }
    }

    async saveCompanionAvatar(
        companionId: number,
        file: Express.Multer.File,
    ): Promise<string> {
        const kind = imageKindFromBytes(file.buffer);
        if (!kind) {
            throw new BadRequestException('Avatar must be a JPEG, PNG, or WebP image');
        }

        return this.save(file.buffer, {
            directory: 'companions',
            fileName: `${companionId}-${randomUUID()}${extensionForImageKind(kind)}`,
        });
    }

    async saveVoiceAudio(
        userId: number,
        audio: Buffer,
        extension = '.wav',
    ): Promise<string> {
        return this.save(audio, {
            directory: `voice/${userId}`,
            fileName: `${randomUUID()}${extension}`,
        });
    }

    async saveGeneratedImage(
        userId: number,
        image: Buffer,
        _mimeType: string,
    ): Promise<string> {
        const kind = imageKindFromBytes(image);
        if (!kind) {
            throw new BadRequestException('Image must be a JPEG, PNG, or WebP image');
        }

        return this.save(image, {
            directory: `images/${userId}`,
            fileName: `${randomUUID()}${extensionForImageKind(kind)}`,
        });
    }

    /**
     * Voice notes and gallery images live in per-user folders. Portraits share
     * one directory and are removed one companion at a time.
     *
     * TODO: store portraits under companions/{userId}/ so deletion can drop one
     * prefix. Until then a failed listing is incomplete and must not be queued
     * as companions/, which would delete every user's portraits.
     */
    async removeUserFiles(
        userId: number,
        companionIds: readonly number[],
    ): Promise<StorageRemoval> {
        const failures: StorageRemoval['failures'] = [];
        let incomplete = false;

        for (const prefix of [`voice/${userId}/`, `images/${userId}/`]) {
            try {
                await this.objects.deletePrefix(prefix);
            } catch (error) {
                failures.push({ key: prefix, error: errorText(error) });
            }
        }

        try {
            const portraits = await this.objects.list('companions/');
            const names = portraits.map((key) => key.slice('companions/'.length));
            for (const name of companionFilesIn(names, companionIds)) {
                const key = `companions/${name}`;
                try {
                    await this.objects.delete(key);
                } catch (error) {
                    failures.push({ key, error: errorText(error) });
                }
            }
        } catch (error) {
            incomplete = true;
            this.logger.warn(
                `Portrait listing failed during account deletion: ${errorText(error)}`,
            );
        }

        return { failures, incomplete };
    }

    async removeVoiceFile(userId: number, url: unknown): Promise<void> {
        const name = ownVoiceFile(url, userId);
        if (!name) return;
        await this.objects.delete(`voice/${userId}/${name}`);
    }

    async removeImageFile(userId: number, url: unknown): Promise<void> {
        const name = ownUserFile(url, 'images', userId);
        if (!name) return;
        await this.objects.delete(`images/${userId}/${name}`);
    }

    /** Replaces stored file paths in a response body with short-lived URLs. */
    signFileUrls<T>(value: T): Promise<T> {
        return signFileUrlFields(value, async (stored) => {
            const path = stored.split(/[?#]/, 1)[0] ?? '';
            // Only our stored keys. An unrelated absolute URL is left as it is.
            if (!path.includes('/uploads/')) return stored;
            const key = objectKeyFromReference(stored);
            if (!key) return stored;
            return this.objects.signedUrl(key);
        });
    }

    /**
     * Present only for the local driver. The S3 driver returns absolute
     * presigned URLs, so nothing is served from this process.
     */
    localDownloadHandler(): RequestHandler | null {
        if (!(this.objects instanceof LocalObjectStorage)) return null;
        return createLocalDownloadHandler(this.objects);
    }
}

function errorText(error: unknown): string {
    return error instanceof Error ? error.message : 'Storage delete failed';
}
