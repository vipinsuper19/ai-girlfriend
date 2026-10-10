import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';
import {
    mkdir,
    readdir,
    rm,
    writeFile,
} from 'fs/promises';

import { join } from 'path';

import {
    avatarExtension,
    companionFilesIn,
    generatedImageExtension,
    ownUserFile,
    ownVoiceFile,
} from './file-types.js';

export interface StorageSaveOptions {
    directory: string;
    fileName?: string;
    extension?: string;
}

@Injectable()
export class StorageService {
    private readonly uploadRoot =
        join(
            process.cwd(),
            'uploads',
        );

    async save(
        file: Buffer,
        options: StorageSaveOptions,
    ): Promise<string> {
        try {
            if (!file?.length) {
                throw new Error(
                    'File is empty',
                );
            }

            const directory =
                join(
                    this.uploadRoot,
                    options.directory,
                );

            await mkdir(
                directory,
                {
                    recursive: true,
                },
            );

            const extension =
                options.extension ?? '';

            const fileName =
                options.fileName ??
                `${randomUUID()}${extension}`;

            const filePath =
                join(
                    directory,
                    fileName,
                );

            await writeFile(
                filePath,
                file,
            );

            return `/uploads/${options.directory}/${fileName}`;
        } catch {
            throw new InternalServerErrorException(
                'Failed to save file',
            );
        }
    }

    async saveCompanionAvatar(
        companionId: number,
        file: Express.Multer.File,
    ): Promise<string> {
        const extension = avatarExtension(file.mimetype);

        if (!extension) {
            throw new BadRequestException(
                'Avatar must be a JPEG, PNG, or WebP image',
            );
        }

        return this.save(
            file.buffer,
            {
                directory:
                    'companions',
                fileName:
                    `${companionId}-${randomUUID()}${extension}`,
            },
        );
    }

    async saveVoiceAudio(
        userId: number,
        audio: Buffer,
        extension = '.wav',
    ): Promise<string> {
        return this.save(
            audio,
            {
                directory:
                    `voice/${userId}`,
                fileName:
                    `${randomUUID()}${extension}`,
            },
        );
    }

    /**
     * Uploads are public by URL, so deleting an account also deletes the
     * voice notes, gallery images, and portraits it stored.
     */
    async removeUserFiles(
        userId: number,
        companionIds: readonly number[],
    ): Promise<void> {
        for (const dir of ['voice', 'images']) {
            await rm(
                join(this.uploadRoot, dir, String(userId)),
                { recursive: true, force: true },
            );
        }

        const portraits = join(this.uploadRoot, 'companions');
        const names = await readdir(portraits).catch(() => [] as string[]);

        for (const name of companionFilesIn(names, companionIds)) {
            await rm(join(portraits, name), { force: true });
        }
    }

    async removeVoiceFile(userId: number, url: unknown): Promise<void> {
        const name = ownVoiceFile(url, userId);
        if (!name) return;
        await rm(
            join(this.uploadRoot, 'voice', String(userId), name),
            { force: true },
        );
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

    async removeImageFile(userId: number, url: unknown): Promise<void> {
        const name = ownUserFile(url, 'images', userId);
        if (!name) return;
        await rm(
            join(this.uploadRoot, 'images', String(userId), name),
            { force: true },
        );
    }
}
