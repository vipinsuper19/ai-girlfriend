import {
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { parseAgeAttestation } from '../auth/age.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageCleanup } from '../storage/storage-cleanup.js';
import { StorageService } from '../storage/storage.service.js';
import { deleteAccountStorageFirst } from './account-deletion.js';
import type { ConfirmAgeDto } from './dto/confirm-age.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import { exportRows, flagColumn, userView } from './user-view.js';

@Injectable()
export class UsersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
        private readonly cleanup: StorageCleanup,
    ) { }

    async findMe(userId: string) {
        const user = await this.requireUser(userId);
        return userView(user);
    }

    async updateMe(
        userId: string,
        dto: UpdateUserDto,
    ) {
        const db = this.prisma.client as any;
        const user = await this.requireUser(userId);
        const now = new Date().toISOString();

        const updateData: Record<string, unknown> = {};

        if (dto.displayName !== undefined) {
            updateData.displayName = dto.displayName.trim();
        }

        const memoryPausedAt = flagColumn(dto.memoryPaused, user.memoryPausedAt, now);
        if (memoryPausedAt !== undefined) {
            updateData.memoryPausedAt = memoryPausedAt;
        }

        const notificationsEnabledAt = flagColumn(
            dto.notificationsEnabled,
            user.notificationsEnabledAt,
            now,
        );
        if (notificationsEnabledAt !== undefined) {
            updateData.notificationsEnabledAt = notificationsEnabledAt;
        }

        if (Object.keys(updateData).length === 0) {
            return userView(user);
        }

        const updatedUser =
            await db.orm.public.User.where({
                id: Number(userId),
            }).update(updateData);

        return userView(updatedUser);
    }

    /** Checks the date of birth, then stores only the confirmation time. */
    async confirmAge(userId: string, dto: ConfirmAgeDto) {
        const age = parseAgeAttestation(dto, new Date(), { required: true });
        await this.requireUser(userId);

        const db = this.prisma.client as any;
        const updated = await db.orm.public.User.where({
            id: Number(userId),
        }).update(age);

        if (!updated) {
            throw new NotFoundException('User not found');
        }

        return age;
    }

    /**
     * Everything stored for this account, as one JSON document. Media fields
     * are signed on the way out, the same as every other response.
     */
    async exportMe(userId: string) {
        const db = this.prisma.client as any;
        const id = Number(userId);
        const user = await this.requireUser(userId);

        const companions = await db.orm.public.Companion.where({ userId: id }).all();
        const companionIds = companions.map((row: { id: number }) => row.id);

        const byCompanion = async (model: string) => {
            const rows: Record<string, unknown>[] = [];
            for (const companionId of companionIds) {
                rows.push(...await db.orm.public[model].where({ companionId }).all());
            }
            return rows;
        };

        const conversations = await db.orm.public.Conversation
            .where({ userId: id, deletedAt: null })
            .all();
        const messages: Record<string, unknown>[] = [];
        for (const conversation of conversations) {
            messages.push(
                ...await db.orm.public.Message
                    .where({ conversationId: conversation.id, deletedAt: null })
                    .orderBy((message: any) => message.id.asc())
                    .all(),
            );
        }

        return {
            exportedAt: new Date().toISOString(),
            user: {
                ...userView(user),
                ageConfirmedAt: user.ageConfirmedAt ?? null,
            },
            companions: exportRows(companions),
            appearances: exportRows(await byCompanion('CompanionAppearance')),
            personalities: exportRows(await byCompanion('CompanionPersonality')),
            voices: exportRows(await byCompanion('CompanionVoice')),
            conversations: exportRows(conversations),
            messages: exportRows(messages),
            memories: exportRows(
                await db.orm.public.Memory
                    .where({ userId: id, status: 'ACTIVE', deletedAt: null })
                    .all(),
            ),
            images: exportRows(
                await db.orm.public.ImageGeneration.where({ userId: id }).all(),
            ),
            subscriptions: exportRows(
                await db.orm.public.Subscription.where({ userId: id }).all(),
            ),
            usage: exportRows(
                await db.orm.public.UsageRecord.where({ userId: id }).all(),
            ),
        };
    }

    private async requireUser(userId: string) {
        const db = this.prisma.client as any;
        const user = await db.orm.public.User.where({
            id: Number(userId),
        }).first();

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    async deleteMe(userId: string) {
        const db = this.prisma.client as any;
        const user = await db.orm.public.User.where({
            id: userId,
        }).first();

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const companions =
            await db.orm.public.Companion.where({
                userId: Number(userId),
            }).all();

        // Earlier failed deletes are retried while this account still exists.
        // A cleanup-table error stops here so the user row is not removed first.
        await this.cleanup.retryPending();

        await deleteAccountStorageFirst({
            removeFiles: () => this.storage.removeUserFiles(
                Number(userId),
                companions.map((companion: { id: number }) => Number(companion.id)),
            ),
            recordFailures: (failures) => this.cleanup.record(failures),
            deleteUser: async () => {
                /*
                 * Delete all active sessions first.
                 * This prevents orphan sessions if your database
                 * schema does not use ON DELETE CASCADE.
                 */
                const sessions =
                    await db.orm.public.Session.where({
                        userId,
                    }).all();

                for (const session of sessions) {
                    await db.orm.public.Session.where({
                        id: session.id,
                    }).delete();
                }

                await db.orm.public.User.where({
                    id: userId,
                }).delete();
            },
        });

        return {
            message: 'Account deleted successfully',
        };
    }
}