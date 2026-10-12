import {
    BadRequestException,
    Inject,
    Injectable,
    InternalServerErrorException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';

import type { RequestHandler } from 'express';

import {
    avatarExtension,
    companionFilesIn,
    generatedImageExtension,
    ownUserFile,
    ownVoiceFile,
} from './file-types.js';
import { contentTypeForKey } from './content-type.js';
import { createLocalDownloadHandler, LocalObjectStorage } from './local-storage.js';
import { isObjectKey, objectKeyFromReference, storedPath } from './object-key.js';
import { OBJECT_STORAGE, type ObjectStorage } from './object-storage.js';
import { signFileUrlFields } from './sign-file-urls.js';

export interface StorageSaveOptions {
    directory: string;
    fileName?: string;
    extension?: string;
}

@Injectable()
export class StorageService {
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
        const extension = avatarExtension(file.mimetype);
        if (!extension) {
            throw new BadRequestException('Avatar must be a JPEG, PNG, or WebP image');
        }

        return this.save(file.buffer, {
            directory: 'companions',
            fileName: `${companionId}-${randomUUID()}${extension}`,
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
        mimeType: string,
    ): Promise<string> {
        return this.save(image, {
            directory: `images/${userId}`,
            fileName: `${randomUUID()}${generatedImageExtension(mimeType)}`,
        });
    }

    /**
     * Voice notes and gallery images live in per-user folders. Portraits share
     * one directory and are removed one companion at a time.
     */
    async removeUserFiles(
        userId: number,
        companionIds: readonly number[],
    ): Promise<void> {
        await this.objects.deletePrefix(`voice/${userId}/`);
        await this.objects.deletePrefix(`images/${userId}/`);

        const portraits = await this.objects.list('companions/');
        const names = portraits.map((key) => key.slice('companions/'.length));
        for (const name of companionFilesIn(names, companionIds)) {
            await this.objects.delete(`companions/${name}`);
        }
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
