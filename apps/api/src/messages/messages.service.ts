import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import type { ListMessagesDto } from './dto/list-messages.dto.js';
import { messagePageLimit, orderMessagePage } from './message-page.js';
import { regenerateProblem } from './regenerate.js';
import { AiService } from '../ai/ai.service.js';
import { safetyNoticeOf } from '../moderation/safety-policy.js';
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
        private readonly storageService: StorageService,
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

        const conversation = await this.getOwnedConversation(
            userId,
            conversationId,
        );

        const now = new Date().toISOString();

        const message =
            await this.db.orm.public.Message.create({
                conversationId: numericConversationId,
                role: 'USER',
                type: 'TEXT',
                content: dto.content.trim(),
                metadata: dto.metadata ?? null,
                audioUrl: null,
                imageUrl: null,
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

        const safety = safetyNoticeOf(assistantMessage);
        if (!safety) {
            await this.usageService.consume(
                numericUserId,
                UsageFeatureDto.MESSAGES,
                1,
                { conversationId: numericConversationId },
            );
            void this.memoryExtractorService.extractFromConversation(
                numericUserId,
                conversation.companionId,
                numericConversationId,
                message.content,
                assistantMessage.content,
            );
        }

        let userMessage = message;
        if (safety && message?.id != null) {
            const fresh = await this.db.orm.public.Message
                .where({ id: message.id })
                .first();
            if (fresh && fresh.id === message.id) userMessage = fresh;
        }

        return {
            userMessage,
            assistantMessage,
            ...(safety ? { safety } : {}),
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

        await this.storageService.removeVoiceFile(
            numericUserId,
            message.audioUrl,
        );

        return {
            message: 'Message deleted successfully',
        };
    }

    /**
     * Replaces her latest reply with a new one. The old row is soft-deleted
     * first so the model answers the same user line again.
     */
    async regenerate(
        userId: string,
        messageId: string,
    ) {
        const numericUserId = Number(userId);
        const numericMessageId = Number(messageId);

        if (!Number.isInteger(numericMessageId) || numericMessageId <= 0) {
            throw new NotFoundException('Message not found');
        }

        const target =
            await this.db.orm.public.Message
                .where({ id: numericMessageId, deletedAt: null })
                .first();

        if (!target) {
            throw new NotFoundException('Message not found');
        }

        const conversation = await this.getOwnedConversation(
            userId,
            target.conversationId,
        );

        const newest =
            await this.db.orm.public.Message
                .where({ conversationId: conversation.id, deletedAt: null })
                .orderBy((message: any) => message.id.desc())
                .limit(1)
                .all();

        const problem = regenerateProblem(target, newest[0]);
        if (problem === 'Message not found') {
            throw new NotFoundException(problem);
        }
        if (problem) {
            throw new BadRequestException(problem);
        }

        const now = new Date().toISOString();
        await this.db.orm.public.Message
            .where({ id: numericMessageId })
            .update({ deletedAt: now, updatedAt: now });

        try {
            const assistantMessage =
                await this.aiService.generateResponse(
                    numericUserId,
                    conversation.id,
                );

            const safety = safetyNoticeOf(assistantMessage);
            if (!safety) {
                await this.usageService.consume(
                    numericUserId,
                    UsageFeatureDto.MESSAGES,
                    1,
                    { conversationId: conversation.id, source: 'regenerate' },
                );
            }

            return {
                replacedId: numericMessageId,
                assistantMessage,
                ...(safety ? { safety } : {}),
            };
        } catch (error) {
            await this.db.orm.public.Message
                .where({ id: numericMessageId })
                .update({ deletedAt: null, updatedAt: new Date().toISOString() });
            throw error;
        }
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

        const now = new Date().toISOString();

        const userMessage =
            await this.db.orm.public.Message.create({
                conversationId: numericConversationId,
                role: 'USER',
                type: 'TEXT',
                content: dto.content.trim(),
                metadata: dto.metadata ?? null,
                audioUrl: null,
                imageUrl: null,
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
            if (event.type === 'done') {
                const notice =
                    event.safety ??
                    safetyNoticeOf(
                        event.message as { metadata?: unknown },
                    );
                if (!notice) {
                    await this.usageService.consume(
                        Number(userId),
                        UsageFeatureDto.MESSAGES,
                        1,
                        { conversationId: numericConversationId },
                    );
                }
            }
            yield event;
        }
    }
}