import {
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateAvatarDto } from './dto/create-avatar.dto.js';
import type { UpdateAvatarDto } from './dto/update-avatar.dto.js';
import { StorageService } from '../storage/storage.service.js';
import {
    archiveFields,
    listStatus,
    restoreFields,
    restoreProblem,
} from './companion-status.js';

@Injectable()
export class AvatarsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly storageService: StorageService,
    ) { }

    private get db(): any {
        return this.prisma.client;
    }

    async create(
        userId: string,
        dto: CreateAvatarDto,
    ) {
        const numericUserId = Number(userId);

        /*
         * Prisma Next generated contract API.
         * Companion is PascalCase under orm.public.
         */
        const companion = await this.db.orm.public.Companion.create({
            userId: numericUserId,
            name: dto.name.trim(),
            gender: dto.gender,
            status: 'ACTIVE',
            systemPrompt: dto.systemPrompt ?? null,
            greeting: dto.greeting ?? null,
        });

        if (dto.appearance) {
            await this.db.orm.public.CompanionAppearance.create({
                companionId: companion.id,
                age: dto.appearance.age ?? null,
                ethnicity: dto.appearance.ethnicity ?? null,
                skinTone: dto.appearance.skinTone ?? null,
                hairColor: dto.appearance.hairColor ?? null,
                hairStyle: dto.appearance.hairStyle ?? null,
                eyeColor: dto.appearance.eyeColor ?? null,
                bodyType: dto.appearance.bodyType ?? null,
                height: dto.appearance.height ?? null,
                clothingStyle: dto.appearance.clothingStyle ?? null,
                avatarUrl: dto.appearance.avatarUrl ?? null,
                imagePrompt: dto.appearance.imagePrompt ?? null,
                metadata: dto.appearance.metadata ?? null,
            });
        }

        if (dto.personality) {
            await this.db.orm.public.CompanionPersonality.create({
                companionId: companion.id,
                traits: dto.personality.traits ?? [],
                interests: dto.personality.interests ?? [],
                likes: dto.personality.likes ?? null,
                dislikes: dto.personality.dislikes ?? null,
                humorLevel: dto.personality.humorLevel ?? 5,
                flirtLevel: dto.personality.flirtLevel ?? 5,
                empathyLevel: dto.personality.empathyLevel ?? 7,
                romanceLevel: dto.personality.romanceLevel ?? 5,
                communicationStyle:
                    dto.personality.communicationStyle ?? null,
                metadata: dto.personality.metadata ?? null,
            });
        }

        if (dto.voice?.provider && dto.voice?.voiceId) {
            await this.db.orm.public.CompanionVoice.create({
                companionId: companion.id,
                provider: dto.voice.provider,
                voiceId: dto.voice.voiceId,
                language: dto.voice.language ?? 'en',
                speed: dto.voice.speed ?? 1,
                pitch: dto.voice.pitch ?? 1,
                settings: dto.voice.settings ?? null,
            });
        }

        return this.findOne(
            numericUserId,
            companion.id,
        );

    }

    async findAll(
        userId: string,
        status?: string | null,
    ) {
        return this.db.orm.public.Companion
            .where({
                userId: Number(userId),
                status: listStatus(status),
            })
            .all();
    }

    async findOne(
        userId: number,
        companionId: number,
    ) {
        const companion = await this.db.orm.public.Companion
            .where({
                id: companionId,
                userId,
                status: 'ACTIVE',
            })
            .first();

        if (!companion) {
            throw new NotFoundException('Companion not found');
        }

        const appearance =
            await this.db.orm.public.CompanionAppearance
                .where({ companionId })
                .first();

        const personality =
            await this.db.orm.public.CompanionPersonality
                .where({ companionId })
                .first();

        const voice =
            await this.db.orm.public.CompanionVoice
                .where({ companionId })
                .first();

        return {
            ...companion,
            appearance,
            personality,
            voice,
        };

    }

    async getOne(
        userId: string,
        companionId: string,
    ) {
        return this.findOne(
            Number(userId),
            Number(companionId),
        );
    }

    async update(
        userId: string,
        companionId: string,
        dto: UpdateAvatarDto,
    ) {
        const numericUserId = Number(userId);
        const numericCompanionId = Number(companionId);

        await this.findOne(
            numericUserId,
            numericCompanionId,
        );

        const companionData: Record<string, unknown> = {};

        if (dto.name !== undefined) {
            companionData.name = dto.name.trim();
        }

        if (dto.gender !== undefined) {
            companionData.gender = dto.gender;
        }

        if (dto.systemPrompt !== undefined) {
            companionData.systemPrompt = dto.systemPrompt;
        }

        if (dto.greeting !== undefined) {
            companionData.greeting = dto.greeting;
        }

        if (Object.keys(companionData).length > 0) {
            await this.db.orm.public.Companion
                .where({
                    id: numericCompanionId,
                    userId: numericUserId,
                })
                .update(companionData);
        }

        if (dto.appearance) {
            const existingAppearance =
                await this.db.orm.public.CompanionAppearance
                    .where({
                        companionId: numericCompanionId,
                    })
                    .first();

            if (existingAppearance) {
                await this.db.orm.public.CompanionAppearance
                    .where({
                        companionId: numericCompanionId,
                    })
                    .update(dto.appearance);
            } else {
                await this.db.orm.public.CompanionAppearance.create({
                    companionId: numericCompanionId,
                    ...dto.appearance,
                });
            }
        }

        if (dto.personality) {
            const existingPersonality =
                await this.db.orm.public.CompanionPersonality
                    .where({
                        companionId: numericCompanionId,
                    })
                    .first();

            if (existingPersonality) {
                await this.db.orm.public.CompanionPersonality
                    .where({
                        companionId: numericCompanionId,
                    })
                    .update(dto.personality);
            } else {
                await this.db.orm.public.CompanionPersonality.create({
                    companionId: numericCompanionId,
                    traits: dto.personality.traits ?? [],
                    interests: dto.personality.interests ?? [],
                    likes: dto.personality.likes ?? null,
                    dislikes: dto.personality.dislikes ?? null,
                    humorLevel: dto.personality.humorLevel ?? 5,
                    flirtLevel: dto.personality.flirtLevel ?? 5,
                    empathyLevel: dto.personality.empathyLevel ?? 7,
                    romanceLevel: dto.personality.romanceLevel ?? 5,
                    communicationStyle:
                        dto.personality.communicationStyle ?? null,
                    metadata: dto.personality.metadata ?? null,
                });
            }
        }

        if (dto.voice) {
            const existingVoice =
                await this.db.orm.public.CompanionVoice
                    .where({
                        companionId: numericCompanionId,
                    })
                    .first();

            if (existingVoice) {
                await this.db.orm.public.CompanionVoice
                    .where({
                        companionId: numericCompanionId,
                    })
                    .update(dto.voice);
            } else if (
                dto.voice.provider &&
                dto.voice.voiceId
            ) {
                await this.db.orm.public.CompanionVoice.create({
                    companionId: numericCompanionId,
                    provider: dto.voice.provider,
                    voiceId: dto.voice.voiceId,
                    language: dto.voice.language ?? 'en',
                    speed: dto.voice.speed ?? 1,
                    pitch: dto.voice.pitch ?? 1,
                    settings: dto.voice.settings ?? null,
                });
            }
        }

        return this.findOne(
            numericUserId,
            numericCompanionId,
        );

    }

    async remove(
        userId: string,
        companionId: string,
    ) {
        const numericUserId = Number(userId);
        const numericCompanionId = Number(companionId);

        await this.findOne(
            numericUserId,
            numericCompanionId,
        );

        await this.db.orm.public.Companion
            .where({
                id: numericCompanionId,
                userId: numericUserId,
            })
            .update(
                archiveFields(new Date().toISOString()),
            );

        return {
            message: 'Companion archived successfully',
        };

    }

    async restore(
        userId: string,
        companionId: string,
    ) {
        const numericUserId = Number(userId);
        const numericCompanionId = Number(companionId);

        const companion =
            await this.db.orm.public.Companion
                .where({
                    id: numericCompanionId,
                    userId: numericUserId,
                })
                .first();

        if (!companion || restoreProblem(companion.status)) {
            throw new NotFoundException(
                'Companion not found',
            );
        }

        if (companion.status !== 'ACTIVE') {
            await this.db.orm.public.Companion
                .where({
                    id: numericCompanionId,
                    userId: numericUserId,
                })
                .update(restoreFields());
        }

        return this.findOne(
            numericUserId,
            numericCompanionId,
        );

    }

    async uploadAvatar(
        userId: string,
        companionId: string,
        file: Express.Multer.File,
    ) {
        const db = this.prisma.client as any;

        const numericUserId = Number(userId);
        const numericCompanionId = Number(companionId);

        const companion =
            await db.orm.public.Companion
                .where({
                    id: numericCompanionId,
                    userId: numericUserId,
                    status: 'ACTIVE',
                })
                .first();

        if (!companion) {
            throw new NotFoundException(
                'Companion not found',
            );
        }

        const avatarUrl =
            await this.storageService.saveCompanionAvatar(
                numericCompanionId,
                file,
            );

        const existingAppearance =
            await db.orm.public.CompanionAppearance
                .where({
                    companionId: numericCompanionId,
                })
                .first();

        let appearance;

        if (existingAppearance) {
            appearance =
                await db.orm.public.CompanionAppearance
                    .where({
                        companionId: numericCompanionId,
                    })
                    .update({
                        avatarUrl,
                    });
        } else {
            appearance =
                await db.orm.public.CompanionAppearance.create({
                    data: {
                        companionId: numericCompanionId,
                        avatarUrl,
                    },
                });
        }

        return {
            companionId: numericCompanionId,
            avatarUrl,
            appearance,
        };
    }
}