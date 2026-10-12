import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { isUniqueViolation } from '../reports/unique-violation.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import type { ListMessagesDto } from './dto/list-messages.dto.js';
import { acquireConversationLock, withConversationLock } from './conversation-lock.js';
import { idempotencyFresh, parseIdempotencyKey } from './idempotency.js';
import { messagePageLimit, orderMessagePage } from './message-page.js';
import {
    IdempotencyKeyReusedException,
    NotLatestUserMessageException,
} from './messages.exceptions.js';
import { regenerateProblem } from './regenerate.js';
import { replyTargetProblem } from './reply-target.js';
import { AiService } from '../ai/ai.service.js';
import {
    excludedFromThread,
    isCannedAssistantText,
    safetyNoticeOf,
    type SafetyNotice,
} from '../moderation/safety-policy.js';
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
        idempotencyKey?: string | string[] | null,
    ) {
        const key = parseIdempotencyKey(idempotencyKey);
        const numericUserId = Number(userId);
        const numericConversationId = Number(conversationId);

        const conversation = await this.getOwnedConversation(
            userId,
            conversationId,
        );

        if (key) {
            return this.createWithIdempotencyKey(
                numericUserId,
                numericConversationId,
                conversation,
                dto,
                key,
            );
        }

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

        await this.touchConversation(numericConversationId, numericUserId, now);

        return withConversationLock(numericConversationId, () =>
            this.completeReply({
                userId,
                conversationId: numericConversationId,
                companionId: conversation.companionId,
                userMessage: message,
                userContent: dto.content,
            }),
        );
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
            return withoutCannedReplies(await messages
                .orderBy((message: any) =>
                    message.createdAt.asc(),
                )
                .all());
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

        return withoutCannedReplies(orderMessagePage(await page.all()));
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
        let assistantMessage: { content?: string; metadata?: unknown };
        const release = await acquireConversationLock(conversation.id);
        try {
            await this.db.orm.public.Message
                .where({ id: numericMessageId })
                .update({ deletedAt: now, updatedAt: now });

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
        } finally {
            release();
        }

        const safety = safetyNoticeOf(assistantMessage);
        if (!safety) {
            await this.chargeSuccessfulReply(
                numericUserId,
                conversation.id,
                '',
                messageContent(assistantMessage),
                { source: 'regenerate' },
            );
        }

        return {
            replacedId: numericMessageId,
            assistantMessage,
            ...(safety ? { safety } : {}),
        };
    }

    private async createWithIdempotencyKey(
        userId: number,
        conversationId: number,
        conversation: { id: number; companionId: number },
        dto: CreateMessageDto,
        key: string,
    ) {
        const existing = await this.freshIdempotentMessage(userId, key);
        if (existing) {
            return this.finishIdempotentSend(
                existing,
                conversation,
                userId,
                conversationId,
            );
        }

        await this.assertWithinLlmCap(userId);
        const release = await acquireConversationLock(conversationId);
        try {
            const inserted = await this.insertIdempotentMessage(
                userId,
                conversationId,
                dto,
                key,
            );
            if (inserted.reused) {
                return this.continueIdempotentSend(
                    inserted.message,
                    conversation,
                    userId,
                    conversationId,
                );
            }

            await this.touchConversation(
                conversationId,
                userId,
                new Date().toISOString(),
            );
            return this.completeReply({
                userId,
                conversationId,
                companionId: conversation.companionId,
                userMessage: inserted.message,
                userContent: dto.content,
            });
        } finally {
            release();
        }
    }

    private async finishIdempotentSend(
        message: { id: number; conversationId: number; content?: string | null },
        conversation: { id: number; companionId: number },
        userId: number,
        conversationId: number,
    ) {
        if (message.conversationId !== conversationId) {
            throw new IdempotencyKeyReusedException();
        }
        const reply = await this.followingAssistant(message);
        if (reply) return this.replyResult(message, reply);
        if (await this.hasLaterUserMessage(message)) {
            throw new NotLatestUserMessageException();
        }

        await this.assertWithinLlmCap(userId);
        const release = await acquireConversationLock(conversationId);
        try {
            return this.continueIdempotentSend(
                message,
                conversation,
                userId,
                conversationId,
            );
        } finally {
            release();
        }
    }

    /**
     * Caller holds the conversation lock. Returns the saved reply, or
     * generates one when this user line is still the latest and unanswered.
     */
    private async continueIdempotentSend(
        message: { id: number; conversationId: number; content?: string | null },
        conversation: { companionId: number },
        userId: number,
        conversationId: number,
    ) {
        if (message.conversationId !== conversationId) {
            throw new IdempotencyKeyReusedException();
        }
        const reply = await this.followingAssistant(message);
        if (reply) return this.replyResult(message, reply);
        if (await this.hasLaterUserMessage(message)) {
            throw new NotLatestUserMessageException();
        }
        return this.completeReply({
            userId,
            conversationId,
            companionId: conversation.companionId,
            userMessage: message,
            userContent: messageContent(message),
        });
    }

    private async *createAndStreamWithKey(
        userId: string,
        conversationId: string,
        dto: CreateMessageDto,
        key: string,
        signal?: AbortSignal,
    ) {
        const numericUserId = Number(userId);
        const numericConversationId = Number(conversationId);
        await this.getOwnedConversation(userId, conversationId);
        const existing = await this.freshIdempotentMessage(
            numericUserId,
            key,
        );

        if (existing) {
            if (existing.conversationId !== numericConversationId) {
                throw new IdempotencyKeyReusedException();
            }
            const reply = await this.followingAssistant(existing);
            if (reply) {
                yield { type: 'message', message: existing };
                yield this.doneEvent(reply);
                return;
            }
            if (await this.hasLaterUserMessage(existing)) {
                throw new NotLatestUserMessageException();
            }
            await this.assertWithinLlmCap(numericUserId);
            const release = await acquireConversationLock(numericConversationId);
            try {
                yield* this.streamExistingUserLine(
                    existing,
                    userId,
                    numericConversationId,
                    signal,
                );
            } finally {
                release();
            }
            return;
        }

        await this.assertWithinLlmCap(numericUserId);
        const release = await acquireConversationLock(numericConversationId);
        try {
            const inserted = await this.insertIdempotentMessage(
                numericUserId,
                numericConversationId,
                dto,
                key,
            );
            if (inserted.reused) {
                if (inserted.message.conversationId !== numericConversationId) {
                    throw new IdempotencyKeyReusedException();
                }
                yield* this.streamExistingUserLine(
                    inserted.message,
                    userId,
                    numericConversationId,
                    signal,
                );
                return;
            }

            await this.touchConversation(
                numericConversationId,
                numericUserId,
                new Date().toISOString(),
            );
            yield { type: 'message', message: inserted.message };
            yield* this.billableStream(
                userId,
                numericConversationId,
                dto.content,
                signal,
            );
        } finally {
            release();
        }
    }

    /**
     * Caller holds the conversation lock. A newer user line that landed
     * while this request waited for the lock is rejected here, after the
     * pre-lock check in prepareSend.
     */
    private async *streamExistingUserLine(
        message: { id: number; conversationId: number; content?: string | null },
        userId: string | number,
        conversationId: number,
        signal?: AbortSignal,
    ) {
        const reply = await this.followingAssistant(message);
        if (reply) {
            yield { type: 'message' as const, message };
            yield this.doneEvent(reply);
            return;
        }
        if (await this.hasLaterUserMessage(message)) {
            throw new NotLatestUserMessageException();
        }
        yield { type: 'message' as const, message };
        yield* this.billableStream(
            userId,
            conversationId,
            messageContent(message),
            signal,
        );
    }

    private async *billableStream(
        userId: string | number,
        conversationId: number,
        userContent: string,
        signal?: AbortSignal,
    ) {
        for await (
            const event of this.aiService.streamResponse(
                userId,
                conversationId,
                { signal },
            )
        ) {
            if (event.type === 'done') {
                const notice =
                    event.safety ??
                    safetyNoticeOf(event.message as { metadata?: unknown });
                if (!notice) {
                    await this.chargeSuccessfulReply(
                        Number(userId),
                        conversationId,
                        userContent,
                        messageContent(event.message),
                    );
                }
            }
            if (signal?.aborted) return;
            yield event;
        }
    }

    private async completeReply(args: {
        userId: string | number;
        conversationId: number;
        companionId: number;
        userMessage: { id?: number; content?: string | null };
        userContent: string;
    }) {
        const assistantMessage = await this.aiService.generateResponse(
            args.userId,
            args.conversationId,
        );
        const safety = safetyNoticeOf(assistantMessage);
        if (!safety) {
            await this.chargeSuccessfulReply(
                Number(args.userId),
                args.conversationId,
                args.userContent,
                messageContent(assistantMessage),
            );
            const assistantText = messageContent(assistantMessage);
            if (!isCannedAssistantText(assistantText)) {
                void this.memoryExtractorService.extractFromConversation(
                    Number(args.userId),
                    args.companionId,
                    args.conversationId,
                    messageContent(args.userMessage),
                    assistantText,
                );
            }
        }

        let userMessage: any = args.userMessage;
        if (safety && userMessage?.id != null) {
            const fresh = await this.db.orm.public.Message
                .where({ id: userMessage.id })
                .first();
            if (fresh && fresh.id === userMessage.id) userMessage = fresh;
        }

        return this.replyResult(userMessage, assistantMessage, safety);
    }

    private replyResult<TUser, TAssistant extends { metadata?: unknown }>(
        userMessage: TUser,
        assistantMessage: TAssistant,
        safety: SafetyNotice | null = safetyNoticeOf(assistantMessage),
    ) {
        return {
            userMessage,
            assistantMessage,
            ...(safety ? { safety } : {}),
        };
    }

    private doneEvent(message: { metadata?: unknown }) {
        const safety = safetyNoticeOf(message);
        return {
            type: 'done' as const,
            message,
            ...(safety ? { safety } : {}),
        };
    }

    private async freshIdempotentMessage(userId: number, key: string) {
        const row = await this.db.orm.public.Message
            .where({ userId, idempotencyKey: key })
            .first();
        if (!row) return null;
        if (row.deletedAt != null || !idempotencyFresh(row.createdAt)) {
            await this.db.orm.public.Message
                .where({ id: row.id })
                .update({
                    idempotencyKey: null,
                    updatedAt: new Date().toISOString(),
                });
            return null;
        }
        return row;
    }

    private async insertIdempotentMessage(
        userId: number,
        conversationId: number,
        dto: CreateMessageDto,
        key: string,
    ) {
        const now = new Date().toISOString();
        const data = {
            conversationId,
            userId,
            idempotencyKey: key,
            role: 'USER',
            type: 'TEXT',
            content: dto.content.trim(),
            metadata: dto.metadata ?? null,
            audioUrl: null,
            imageUrl: null,
            updatedAt: now,
        };

        try {
            return {
                message: await this.db.orm.public.Message.create(data),
                reused: false,
            };
        } catch (error) {
            if (!isUniqueViolation(error)) throw error;
            const raced = await this.freshIdempotentMessage(userId, key);
            if (raced) return { message: raced, reused: true };
            try {
                return {
                    message: await this.db.orm.public.Message.create(data),
                    reused: false,
                };
            } catch (again) {
                if (!isUniqueViolation(again)) throw again;
                const winner = await this.db.orm.public.Message
                    .where({ userId, idempotencyKey: key })
                    .first();
                if (!winner) throw again;
                return { message: winner, reused: true };
            }
        }
    }

    private async liveMessage(messageId: number) {
        if (!Number.isInteger(messageId) || messageId <= 0) return null;
        return this.db.orm.public.Message
            .where({ id: messageId, deletedAt: null })
            .first();
    }

    private async followingAssistant(userMessage: {
        id: number;
        conversationId: number;
    }) {
        const rows = await this.db.orm.public.Message
            .where({
                conversationId: userMessage.conversationId,
                deletedAt: null,
            })
            .where((message: { id: { gt(value: number): unknown } }) =>
                message.id.gt(userMessage.id),
            )
            .orderBy((message: { id: { asc(): unknown } }) => message.id.asc())
            .limit(1)
            .all();
        const next = rows[0];
        if (!next || next.role !== 'ASSISTANT') return null;
        return next;
    }

    private async hasLaterUserMessage(userMessage: {
        id: number;
        conversationId: number;
    }) {
        const rows = await this.db.orm.public.Message
            .where({
                conversationId: userMessage.conversationId,
                role: 'USER',
                deletedAt: null,
            })
            .where((message: { id: { gt(value: number): unknown } }) =>
                message.id.gt(userMessage.id),
            )
            .limit(1)
            .all();
        return rows.length > 0;
    }

    private async touchConversation(
        conversationId: number,
        userId: number,
        now: string,
    ) {
        await this.db.orm.public.Conversation
            .where({
                id: conversationId,
                userId,
            })
            .update({
                lastMessageAt: now,
                updatedAt: now,
            });
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

    /**
     * Ownership, idempotent replay, and the free-tier cap, before any bytes
     * are flushed. A completed send is replayed without the cap check.
     */
    async prepareSend(
        userId: string,
        conversationId: string,
        idempotencyKey?: string | string[] | null,
    ) {
        const key = parseIdempotencyKey(idempotencyKey);
        const conversation = await this.getOwnedConversation(
            userId,
            conversationId,
        );
        if (!key) {
            await this.assertWithinLlmCap(Number(userId));
            return;
        }

        const existing = await this.freshIdempotentMessage(Number(userId), key);
        if (!existing) {
            await this.assertWithinLlmCap(Number(userId));
            return;
        }
        if (existing.conversationId !== conversation.id) {
            throw new IdempotencyKeyReusedException();
        }
        if (await this.followingAssistant(existing)) return;
        if (await this.hasLaterUserMessage(existing)) {
            throw new NotLatestUserMessageException();
        }
        await this.assertWithinLlmCap(Number(userId));
    }

    /**
     * 404 / 409 / 403 before the reply stream flushes headers.
     * An assistant reply that already follows this user line skips the cap.
     */
    async prepareReplyStream(
        userId: string,
        conversationId: string,
        userMessageId: string,
    ) {
        const conversation = await this.getOwnedConversation(
            userId,
            conversationId,
        );
        const message = await this.liveMessage(Number(userMessageId));
        const later = message ? await this.hasLaterUserMessage(message) : false;
        const problem = replyTargetProblem(message, conversation.id, later);
        if (problem === 'not_found' || !message) {
            throw new NotFoundException('Message not found');
        }
        if (problem === 'not_latest') {
            throw new NotLatestUserMessageException();
        }
        if (!(await this.followingAssistant(message))) {
            await this.assertWithinLlmCap(Number(userId));
        }
    }

    async *createAndStream(
        userId: string,
        conversationId: string,
        dto: CreateMessageDto,
        signal?: AbortSignal,
        idempotencyKey?: string | string[] | null,
    ) {
        const key = parseIdempotencyKey(idempotencyKey);
        if (key) {
            yield* this.createAndStreamWithKey(
                userId,
                conversationId,
                dto,
                key,
                signal,
            );
            return;
        }

        const numericUserId = Number(userId);
        const numericConversationId = Number(conversationId);

        const conversation = await this.getOwnedConversation(
            userId,
            conversationId,
        );

        await this.assertWithinLlmCap(numericUserId);

        const release = await acquireConversationLock(numericConversationId);
        try {
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

            await this.touchConversation(
                numericConversationId,
                conversation.userId,
                now,
            );

            yield {
                type: 'message',
                message: userMessage,
            };

            yield* this.billableStream(
                userId,
                numericConversationId,
                dto.content,
                signal,
            );
        } finally {
            release();
        }
    }

    /**
     * Generate the assistant reply for a user line that was already saved.
     * If one already follows it, emit `done` and do not charge.
     */
    async *streamReply(
        userId: string,
        conversationId: string,
        userMessageId: string,
        signal?: AbortSignal,
    ) {
        const conversation = await this.getOwnedConversation(
            userId,
            conversationId,
        );
        const release = await acquireConversationLock(conversation.id);
        try {
            const message = await this.liveMessage(Number(userMessageId));
            const later = message ? await this.hasLaterUserMessage(message) : false;
            const problem = replyTargetProblem(message, conversation.id, later);
            if (problem === 'not_found' || !message) {
                throw new NotFoundException('Message not found');
            }
            if (problem === 'not_latest') {
                throw new NotLatestUserMessageException();
            }

            const reply = await this.followingAssistant(message);
            if (reply) {
                yield this.doneEvent(reply);
                return;
            }

            await this.assertWithinLlmCap(Number(userId));
            yield* this.billableStream(
                userId,
                conversation.id,
                messageContent(message),
                signal,
            );
        } finally {
            release();
        }
    }

    /**
     * Check only. `chargeSuccessfulReply` writes the row after the reply exists.
     * Two requests can both pass this check and both finish, so a free account
     * can land slightly over the cap. That overshoot is an accepted MVP
     * limitation: there is no reservation row and no row lock.
     */
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

function withoutCannedReplies<T>(rows: T[]): T[] {
    return rows.filter((row) => !excludedFromThread(
        row as { role?: unknown; metadata?: unknown },
    ));
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