import {
    Injectable,
    InternalServerErrorException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';
import {
    mkdir,
    writeFile,
} from 'fs/promises';

import {
    extname,
    join,
} from 'path';

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
        const extension =
            extname(
                file.originalname,
            ) ||
            this.getExtensionFromMimeType(
                file.mimetype,
            );

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

    private getExtensionFromMimeType(
        mimeType: string,
    ): string {
        const extensions:
            Record<string, string> = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
            'audio/wav': '.wav',
            'audio/mpeg': '.mp3',
            'audio/mp4': '.m4a',
            'audio/ogg': '.ogg',
            'audio/webm': '.webm',
        };

        return extensions[mimeType] ?? '';
    }
}