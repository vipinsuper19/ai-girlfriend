import {
    Injectable,
    InternalServerErrorException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
//import type { Multer } from 'multer';

@Injectable()
export class StorageService {
    private readonly uploadRoot = join(
        process.cwd(),
        'uploads',
    );

    async saveCompanionAvatar(
        companionId: number,
        file: Express.Multer.File,
    ): Promise<string> {
        try {
            const extension =
                extname(file.originalname) ||
                this.getExtensionFromMimeType(file.mimetype);

            const fileName =
                `${companionId}-${randomUUID()}${extension}`;

            const directory = join(
                this.uploadRoot,
                'companions',
            );

            await mkdir(directory, {
                recursive: true,
            });

            const filePath = join(
                directory,
                fileName,
            );

            await writeFile(
                filePath,
                file.buffer,
            );

            return `/uploads/companions/${fileName}`;
        } catch {
            throw new InternalServerErrorException(
                'Failed to save avatar',
            );
        }

    }

    private getExtensionFromMimeType(
        mimeType: string,
    ): string {
        const extensions: Record<string, string> = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
        };

        return extensions[mimeType] ?? '';

    }
}