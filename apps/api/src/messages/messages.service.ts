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
import { MemoryExtractorService } from '../memories/memory-extractor.service.js';
import { UsageFeatureDto } from '../usage/dto/record-usage.dto.js';
import { estimateTokens } from '../usage/estimate-tokens.js';
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

        await this.assertWithinLlmCap(numericUserId);

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

        await this.chargeSuccessfulReply(
            numericUserId,
            numericConversationId,
            dto.content,
            messageContent(assistantMessage),
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

        await this.assertWithinLlmCap(numericUserId);

        const now = new Date().toISOString();
        await this.db.orm.public.Message
            .where({ id: numericMessageId })
            .update({ deletedAt: now, updatedAt: now });

        let assistantMessage: { content?: string };
        try {
            assistantMessage =
                await this.aiService.generateResponse(
                    numericUserId,
                    conversation.id,
                );
        } catch (error) {
            await this.db.orm.public.Message
                .where({ id: numericMessageId })
                .update({ deletedAt: null, updatedAt: new Date().toISOString() });
            throw error;
        }

        await this.chargeSuccessfulReply(
            numericUserId,
            conversation.id,
            '',
            messageContent(assistantMessage),
            { source: 'regenerate' },
        );

        return {
            replacedId: numericMessageId,
            assistantMessage,
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

    /**
     * Ownership and the free-tier cap, before any bytes are flushed.
     * The stream route uses `@Res()`, so this has to throw while the
     * status code can still be a normal JSON error.
     */
    async assertCanReply(
        userId: string,
        conversationId: string,
    ) {
        await this.getOwnedConversation(userId, conversationId);
        await this.assertWithinLlmCap(Number(userId));
    }

    async *createAndStream(
        userId: string,
        conversationId: string,
        dto: CreateMessageDto,
        signal?: AbortSignal,
    ) {
        const numericUserId = Number(userId);
        const numericConversationId =
            Number(conversationId);

        await this.getOwnedConversation(
            userId,
            conversationId,
        );

        await this.assertWithinLlmCap(numericUserId);

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
                { signal },
            )
        ) {
            if (event.type === 'done') {
                await this.chargeSuccessfulReply(
                    numericUserId,
                    numericConversationId,
                    dto.content,
                    messageContent(event.message),
                );
            }
            if (signal?.aborted) return;
            yield event;
        }
    }

    private async assertWithinLlmCap(userId: number) {
        await this.usageService.check(
            userId,
            UsageFeatureDto.MESSAGES,
            1,
        );
        await this.usageService.check(
            userId,
            UsageFeatureDto.TEXT_TOKENS,
            1,
        );
    }

    private async chargeSuccessfulReply(
        userId: number,
        conversationId: number,
        userContent: string,
        assistantContent: string,
        metadata: Record<string, unknown> = {},
    ) {
        const details = { conversationId, ...metadata };
        await this.usageService.charge(
            userId,
            UsageFeatureDto.MESSAGES,
            1,
            details,
        );
        const tokens = estimateTokens(userContent) + estimateTokens(assistantContent);
        if (tokens > 0) {
            await this.usageService.charge(
                userId,
                UsageFeatureDto.TEXT_TOKENS,
                tokens,
                details,
            );
        }
    }
}

function messageContent(message: unknown): string {
    if (
        typeof message === 'object'
        && message !== null
        && 'content' in message
        && typeof message.content === 'string'
    ) {
        return message.content;
    }
    return '';
}