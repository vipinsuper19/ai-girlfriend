import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateAvatarDto } from './dto/create-avatar.dto.js';
import type { UpdateAvatarDto } from './dto/update-avatar.dto.js';
import { StorageService } from '../storage/storage.service.js';
import {
    appearanceFields,
    type FieldPick,
    ownAvatarUrl,
    personalityFields,
    voiceFields,
} from './companion-fields.js';
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
        const appearance = checked(appearanceFields(dto.appearance));
        const personality = checked(personalityFields(dto.personality));
        const voice = checked(voiceFields(dto.voice));

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
                age: appearance.age ?? null,
                ethnicity: appearance.ethnicity ?? null,
                skinTone: appearance.skinTone ?? null,
                hairColor: appearance.hairColor ?? null,
                hairStyle: appearance.hairStyle ?? null,
                eyeColor: appearance.eyeColor ?? null,
                bodyType: appearance.bodyType ?? null,
                height: appearance.height ?? null,
                clothingStyle: appearance.clothingStyle ?? null,
                avatarUrl: null,
                imagePrompt: appearance.imagePrompt ?? null,
                metadata: appearance.metadata ?? null,
            });
        }

        if (dto.personality) {
            await this.db.orm.public.CompanionPersonality.create({
                companionId: companion.id,
                traits: personality.traits ?? [],
                interests: personality.interests ?? [],
                likes: personality.likes ?? null,
                dislikes: personality.dislikes ?? null,
                humorLevel: personality.humorLevel ?? 5,
                flirtLevel: personality.flirtLevel ?? 5,
                empathyLevel: personality.empathyLevel ?? 7,
                romanceLevel: personality.romanceLevel ?? 5,
                communicationStyle:
                    personality.communicationStyle ?? null,
                metadata: personality.metadata ?? null,
            });
        }

        if (voice.provider && voice.voiceId) {
            await this.db.orm.public.CompanionVoice.create({
                companionId: companion.id,
                provider: voice.provider,
                voiceId: voice.voiceId,
                language: voice.language ?? 'en',
                speed: voice.speed ?? 1,
                pitch: voice.pitch ?? 1,
                settings: voice.settings ?? null,
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

        const appearance = dto.appearance
            ? checked(appearanceFields(dto.appearance))
            : null;
        if (appearance && 'avatarUrl' in appearance) {
            appearance.avatarUrl = ownAvatarUrl(appearance.avatarUrl, numericCompanionId);
        }
        const personality = dto.personality
            ? checked(personalityFields(dto.personality))
            : null;
        const voice = dto.voice
            ? checked(voiceFields(dto.voice))
            : null;

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

        if (appearance) {
            const existingAppearance =
                await this.db.orm.public.CompanionAppearance
                    .where({
                        companionId: numericCompanionId,
                    })
                    .first();

            if (existingAppearance) {
                if (Object.keys(appearance).length > 0) {
                    await this.db.orm.public.CompanionAppearance
                        .where({
                            companionId: numericCompanionId,
                        })
                        .update(appearance);
                }
            } else {
                await this.db.orm.public.CompanionAppearance.create({
                    companionId: numericCompanionId,
                    ...appearance,
                });
            }
        }

        if (personality) {
            const existingPersonality =
                await this.db.orm.public.CompanionPersonality
                    .where({
                        companionId: numericCompanionId,
                    })
                    .first();

            if (existingPersonality) {
                if (Object.keys(personality).length > 0) {
                    await this.db.orm.public.CompanionPersonality
                        .where({
                            companionId: numericCompanionId,
                        })
                        .update(personality);
                }
            } else {
                await this.db.orm.public.CompanionPersonality.create({
                    companionId: numericCompanionId,
                    traits: personality.traits ?? [],
                    interests: personality.interests ?? [],
                    likes: personality.likes ?? null,
                    dislikes: personality.dislikes ?? null,
                    humorLevel: personality.humorLevel ?? 5,
                    flirtLevel: personality.flirtLevel ?? 5,
                    empathyLevel: personality.empathyLevel ?? 7,
                    romanceLevel: personality.romanceLevel ?? 5,
                    communicationStyle:
                        personality.communicationStyle ?? null,
                    metadata: personality.metadata ?? null,
                });
            }
        }

        if (voice) {
            const existingVoice =
                await this.db.orm.public.CompanionVoice
                    .where({
                        companionId: numericCompanionId,
                    })
                    .first();

            if (existingVoice) {
                if (Object.keys(voice).length > 0) {
                    await this.db.orm.public.CompanionVoice
                        .where({
                            companionId: numericCompanionId,
                        })
                        .update(voice);
                }
            } else if (
                voice.provider &&
                voice.voiceId
            ) {
                await this.db.orm.public.CompanionVoice.create({
                    companionId: numericCompanionId,
                    provider: voice.provider,
                    voiceId: voice.voiceId,
                    language: voice.language ?? 'en',
                    speed: voice.speed ?? 1,
                    pitch: voice.pitch ?? 1,
                    settings: voice.settings ?? null,
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

function checked(pick: FieldPick): Record<string, any> {
    if (pick.problem) {
        throw new BadRequestException(pick.problem);
    }
    return pick.data;
}
