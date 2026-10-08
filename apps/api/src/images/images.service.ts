import {
    BadRequestException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { UsageFeatureDto } from '../usage/dto/record-usage.dto.js';
import { UsageService } from '../usage/usage.service.js';
import type { CreateImageDto } from './dto/create-image.dto.js';
import type { ListImagesDto } from './dto/list-images.dto.js';
import { companionImagePrompt } from './image-prompt.js';
import { IMAGE_PROVIDER, type ImageProvider } from './image.provider.js';

@Injectable()
export class ImagesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
        private readonly usage: UsageService,
        @Inject(IMAGE_PROVIDER)
        private readonly provider: ImageProvider,
    ) { }

    private get db(): any {
        return this.prisma.client;
    }

    async create(userId: number, dto: CreateImageDto) {
        const companion = await this.db.orm.public.Companion
            .where({ id: dto.companionId, userId, status: 'ACTIVE' })
            .first();

        if (!companion) {
            throw new NotFoundException('Companion not found');
        }

        const appearance = await this.db.orm.public.CompanionAppearance
            .where({ companionId: companion.id })
            .first();

        const { prompt, problem } = companionImagePrompt(
            companion.name,
            companion.gender,
            appearance,
            dto.prompt,
        );
        if (!prompt) {
            throw new BadRequestException(problem);
        }

        await this.usage.check(userId, UsageFeatureDto.IMAGE_GENERATIONS, 1);

        const row = await this.db.orm.public.ImageGeneration.create({
            userId,
            companionId: companion.id,
            conversationId: null,
            messageId: null,
            type: dto.prompt?.trim() ? 'USER_REQUEST' : 'COMPANION_IMAGE',
            status: 'PROCESSING',
            provider: 'GEMINI',
            model: null,
            prompt: dto.prompt?.trim() ?? '',
            enhancedPrompt: prompt,
            imageUrl: null,
            providerImageId: null,
            metadata: null,
            errorCode: null,
            errorMessage: null,
            completedAt: null,
        });

        try {
            const image = await this.provider.generateImage(prompt);
            const imageUrl = await this.storage.saveGeneratedImage(
                userId,
                image.bytes,
                image.mimeType,
            );

            await this.usage.consume(
                userId,
                UsageFeatureDto.IMAGE_GENERATIONS,
                1,
                { imageId: row.id, companionId: companion.id },
            );

            return this.db.orm.public.ImageGeneration
                .where({ id: row.id })
                .update({
                    status: 'COMPLETED',
                    provider: image.provider,
                    model: image.model,
                    imageUrl,
                    completedAt: new Date().toISOString(),
                });
        } catch (error) {
            await this.db.orm.public.ImageGeneration
                .where({ id: row.id })
                .update({
                    status: 'FAILED',
                    errorCode: (error as { name?: string })?.name ?? 'Error',
                    errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'Failed',
                });
            throw error;
        }
    }

    async findAll(userId: number, query: ListImagesDto) {
        const where: Record<string, unknown> = { userId, status: 'COMPLETED' };
        if (query.companionId != null) where.companionId = query.companionId;

        return this.db.orm.public.ImageGeneration
            .where(where)
            .orderBy((image: any) => image.id.desc())
            .limit(query.limit ?? 60)
            .all();
    }

    async findOne(userId: number, id: number) {
        const image = Number.isInteger(id) && id > 0
            ? await this.db.orm.public.ImageGeneration
                .where({ id, userId })
                .first()
            : null;

        if (!image) {
            throw new NotFoundException('Image not found');
        }
        return image;
    }

    async remove(userId: number, id: number) {
        const image = await this.findOne(userId, id);

        await this.db.orm.public.ImageGeneration
            .where({ id: image.id, userId })
            .delete();
        await this.storage.removeImageFile(userId, image.imageUrl);

        return { id: image.id, deleted: true };
    }
}
