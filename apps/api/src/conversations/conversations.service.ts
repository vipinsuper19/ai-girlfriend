import {
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateConversationDto } from './dto/create-conversation.dto.js';

@Injectable()
export class ConversationsService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    private get db(): any {
        return this.prisma.client;
    }

    async create(
        userId: string,
        dto: CreateConversationDto,
    ) {
        const numericUserId = Number(userId);

        const companion =
            await this.db.orm.public.Companion
                .where({
                    id: dto.companionId,
                    userId: numericUserId,
                    status: 'ACTIVE',
                })
                .first();

        if (!companion) {
            throw new NotFoundException(
                'Companion not found',
            );
        }

        const conversation =
            await this.db.orm.public.Conversation.create({
                userId: numericUserId,
                companionId: dto.companionId,
                title: dto.title?.trim() || null,
                metadata: dto.metadata ?? null,
            });

        return conversation;

    }

    async findAll(userId: string) {
        const numericUserId = Number(userId);

        return this.db.orm.public.Conversation
            .where({
                userId: numericUserId,
                deletedAt: null,
            })
            .orderBy((conversation: any) =>
                conversation.lastMessageAt.desc(),
            )
            .all();

    }

    async findOne(
        userId: string,
        conversationId: string,
    ) {
        const conversation =
            await this.db.orm.public.Conversation
                .where({
                    id: Number(conversationId),
                    userId: Number(userId),
                    deletedAt: null,
                })
                .first();

        if (!conversation) {
            throw new NotFoundException(
                'Conversation not found',
            );
        }

        return conversation;

    }

    async remove(
        userId: string,
        conversationId: string,
    ) {
        const numericUserId = Number(userId);
        const numericConversationId =
            Number(conversationId);

        await this.findOne(
            userId,
            conversationId,
        );

        await this.db.orm.public.Conversation
            .where({
                id: numericConversationId,
                userId: numericUserId,
            })
            .update({
                deletedAt: new Date().toISOString(),
            });

        return {
            message: 'Conversation deleted successfully',
        };

    }
}