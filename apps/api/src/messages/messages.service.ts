import {
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import type { ListMessagesDto } from './dto/list-messages.dto.js';
import { messagePageLimit, orderMessagePage } from './message-page.js';
import { AiService } from '../ai/ai.service.js';
import { MemoryExtractorService } from '../memories/memory-extractor.service.js';
import { UsageFeatureDto } from '../usage/dto/record-usage.dto.js';
import { UsageService } from '../usage/usage.service.js';

@Injectable()
export class MessagesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly aiService: AiService,
        private readonly memoryExtractorService: MemoryExtractorService,
        private readonly usageService: UsageService,
    ) { }

    private get db(): any {
        return this.prisma.client;
    }

    async create(
        userId: string,
        conversationId: string,
        dto: CreateMessageDto,
    ) {
        const numericUserId = Number(userId);
        const numericConversationId = Number(conversationId);

        console.log({
            jwtUserId: userId,
            numericUserId: Number(userId),
            conversationId,
            numericConversationId: Number(conversationId),
        });

        const conversation = await this.getOwnedConversation(
            userId,
            conversationId,
        );

        await this.usageService.consume(
            numericUserId,
            UsageFeatureDto.MESSAGES,
            1,
            { conversationId: numericConversationId },
        );

        const now = new Date().toISOString();

        const message =
            await this.db.orm.public.Message.create({
                conversationId: numericConversationId,
                role: 'USER',
                type: dto.type ?? 'TEXT',
                content: dto.content.trim(),
                metadata: dto.metadata ?? null,
                audioUrl: dto.audioUrl ?? null,
                imageUrl: dto.imageUrl ?? null,
                updatedAt: now,
            });

        await this.db.orm.public.Conversation
            .where({
                id: numericConversationId,
                userId: numericUserId,
            })
            .update({
                lastMessageAt: now,
                updatedAt: now,
            });

        const assistantMessage =
            await this.aiService.generateResponse(
                userId,
                conversationId,
            );

        void this.memoryExtractorService.extractFromConversation(
            numericUserId,
            conversation.companionId,
            numericConversationId,
            message.content,
            assistantMessage.content,
        );

        return {
            userMessage: message,
            assistantMessage,
        };
    }

    async findAll(
        userId: string,
        conversationId: string,
        query: ListMessagesDto = {},
    ) {
        const numericConversationId = Number(conversationId);

        await this.getOwnedConversation(
            userId,
            conversationId,
        );

        const limit = messagePageLimit(query.limit);
        let messages = this.db.orm.public.Message
            .where({
                conversationId: numericConversationId,
                deletedAt: null,
            });

        if (query.before == null && limit == null) {
            return messages
                .orderBy((message: any) =>
                    message.createdAt.asc(),
                )
                .all();
        }

        if (query.before != null) {
            messages = messages.where((message: any) =>
                message.id.lt(query.before),
            );
        }

        let page = messages.orderBy((message: any) =>
            message.id.desc(),
        );

        if (limit != null) {
            page = page.limit(limit);
        }

        return orderMessagePage(await page.all());
    }

    async remove(
        userId: string,
        messageId: string,
    ) {
        const numericUserId = Number(userId);
        const numericMessageId = Number(messageId);

        const message =
            await this.db.orm.public.Message
                .where({
                    id: numericMessageId,
                    deletedAt: null,
                })
                .first();

        if (!message) {
            throw new NotFoundException(
                'Message not found',
            );
        }

        const conversation =
            await this.db.orm.public.Conversation
                .where({
                    id: message.conversationId,
                    userId: numericUserId,
                    deletedAt: null,
                })
                .first();

        if (!conversation) {
            throw new NotFoundException(
                'Message not found',
            );
        }

        const now = new Date().toISOString();

        await this.db.orm.public.Message
            .where({
                id: numericMessageId,
            })
            .update({
                deletedAt: now,
                updatedAt: now,
            });

        return {
            message: 'Message deleted successfully',
        };
    }

    private async getOwnedConversation(
        userId: string | number,
        conversationId: string | number,
    ) {
        const numericUserId = Number(userId);
        const numericConversationId = Number(conversationId);

        if (
            !Number.isInteger(numericUserId) ||
            numericUserId <= 0
        ) {
            throw new NotFoundException('Invalid user');
        }

        if (
            !Number.isInteger(numericConversationId) ||
            numericConversationId <= 0
        ) {
            throw new NotFoundException('Invalid conversation ID');
        }

        const conversation =
            await this.db.orm.public.Conversation
                .where({
                    id: numericConversationId,
                    userId: numericUserId,
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

    async *createAndStream(
        userId: string,
        conversationId: string,
        dto: CreateMessageDto,
    ) {
        const numericConversationId =
            Number(conversationId);

        await this.getOwnedConversation(
            userId,
            conversationId,
        );

        await this.usageService.consume(
            Number(userId),
            UsageFeatureDto.MESSAGES,
            1,
            { conversationId: numericConversationId },
        );

        const now = new Date().toISOString();

        const userMessage =
            await this.db.orm.public.Message.create({
                conversationId: numericConversationId,
                role: 'USER',
                type: dto.type ?? 'TEXT',
                content: dto.content.trim(),
                metadata: dto.metadata ?? null,
                audioUrl: dto.audioUrl ?? null,
                imageUrl: dto.imageUrl ?? null,
                updatedAt: now,
            });

        await this.db.orm.public.Conversation
            .where({
                id: numericConversationId,
            })
            .update({
                lastMessageAt: now,
                updatedAt: now,
            });

        yield {
            type: 'message',
            message: userMessage,
        };

        for await (
            const event of this.aiService.streamResponse(
                userId,
                conversationId,
            )
        ) {
            yield event;
        }
    }
}