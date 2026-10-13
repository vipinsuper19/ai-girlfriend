import {
    Inject,
    Injectable,
    NotFoundException,
    forwardRef,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { MemoryContextService } from '../memories/memory-context.service.js';
import { ModerationService } from '../moderation/moderation.service.js';
import {
    companionSafetyRules,
    hiddenFromModel,
    type SafetyNotice,
} from '../moderation/safety-policy.js';
import { takeReadyWindow } from '../moderation/text-windows.js';

import { isAbortError } from './abort-error.js';
import {
    CHAT_PROVIDER,
    type AiChatMessage,
    type ChatProvider,
} from './interfaces/chat-provider.interface.js';

/**
 * Non-overridable companion rules. They are appended after personality text
 * so a saved persona cannot push them out of the prompt.
 */
export const SAFETY_SYSTEM_RULES = companionSafetyRules();

@Injectable()
export class AiService {
    constructor(
        private readonly prisma: PrismaService,

        @Inject(CHAT_PROVIDER)
        private readonly chatProvider: ChatProvider,

        @Inject(forwardRef(() => MemoryContextService))
        private readonly memoryContextService:
            MemoryContextService,

        private readonly moderation: ModerationService,
    ) { }

    private get db(): any {
        return this.prisma.client;
    }

    async generateResponse(
        userId: string | number,
        conversationId: string | number,
        options: {
            persistMessage?: boolean;
        } = {},
    ) {
        const numericUserId = Number(userId);
        const numericConversationId =
            Number(conversationId);

        /*
         * ------------------------------------------------------
         * 1. Load conversation
         * ------------------------------------------------------
         */
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

        /*
         * ------------------------------------------------------
         * 2. Load companion
         * ------------------------------------------------------
         */
        const companion =
            await this.db.orm.public.Companion
                .where({
                    id: conversation.companionId,
                    userId: numericUserId,
                    status: 'ACTIVE',
                })
                .first();

        if (!companion) {
            throw new NotFoundException(
                'Companion not found',
            );
        }

        /*
         * ------------------------------------------------------
         * 3. Load personality
         * ------------------------------------------------------
         */
        const personality =
            await this.db.orm.public.CompanionPersonality
                .where({
                    companionId: companion.id,
                })
                .first();

        /*
         * ------------------------------------------------------
         * 4. Load recent conversation messages
         * ------------------------------------------------------
         */
        const messages =
            await this.db.orm.public.Message
                .where({
                    conversationId:
                        numericConversationId,
                    deletedAt: null,
                })
                .orderBy((message: any) =>
                    message.createdAt.desc(),
                )
                .limit(20)
                .all();

        const chronologicalMessages =
            [...messages].reverse();

        /*
         * ------------------------------------------------------
         * 5. Identify the current user message
         * ------------------------------------------------------
         *
         * MessagesService saves the USER message before
         * calling generateResponse().
         *
         * Therefore the latest USER message is the query
         * used for long-term memory retrieval.
         */
        const currentUserMessage =
            [...chronologicalMessages]
                .reverse()
                .find(
                    (message: any) =>
                        message.role === 'USER' &&
                        message.content?.trim(),
                );

        const inputNotice = await this.moderation.noticeFor(
            currentUserMessage?.content ?? '',
            'input',
            {
                userId: numericUserId,
                conversationId: numericConversationId,
            },
        );

        if (inputNotice) {
            if (currentUserMessage) {
                await this.flagUserMessage(
                    currentUserMessage,
                    inputNotice,
                );
            }
            return this.finishTurn(
                numericConversationId,
                numericUserId,
                inputNotice.message,
                inputNotice,
                options.persistMessage ?? true,
            );
        }

        /*
         * ------------------------------------------------------
         * 6. Retrieve relevant long-term memories
         * ------------------------------------------------------
         */
        const memoryContext =
            currentUserMessage
                ? await this.memoryContextService
                    .buildContext(
                        numericUserId,
                        companion.id,
                        currentUserMessage.content,
                    )
                : '';

        /*
         * ------------------------------------------------------
         * 7. Build AI messages
         * ------------------------------------------------------
         */
        const systemPrompt =
            this.buildSystemPrompt(
                companion,
                personality,
                memoryContext,
            );

        const aiMessages = this.modelMessages(
            systemPrompt,
            chronologicalMessages,
        );

        /*
         * ------------------------------------------------------
         * 8. Generate AI response
         * ------------------------------------------------------
         */
        const responseText =
            await this.chatProvider.generateChat({
                messages: aiMessages,
            });

        const outputNotice = await this.moderation.noticeFor(
            responseText,
            'output',
            {
                userId: numericUserId,
                conversationId: numericConversationId,
            },
        );

        /*
         * ------------------------------------------------------
         * 9. Persist assistant response
         * ------------------------------------------------------
         */
        return this.finishTurn(
            numericConversationId,
            numericUserId,
            outputNotice?.message ?? responseText.trim(),
            outputNotice,
            options.persistMessage ?? true,
        );
    }

    private modelMessages(
        systemPrompt: string,
        chronologicalMessages: any[],
    ): AiChatMessage[] {
        return [
            {
                role: 'system',
                content: systemPrompt,
            },
            ...chronologicalMessages
                .filter(
                    (message: any) =>
                        message.content &&
                        (
                            message.role === 'USER' ||
                            message.role === 'ASSISTANT' ||
                            message.role === 'SYSTEM'
                        ) &&
                        !hiddenFromModel(message),
                )
                .map((message: any) => ({
                    role: this.toAiRole(
                        message.role,
                    ),
                    content:
                        message.content as string,
                })),
        ];
    }

    private async flagUserMessage(
        message: { id?: unknown; metadata?: unknown },
        notice: SafetyNotice,
    ) {
        if (message.id == null) return;
        const existing =
            message.metadata &&
            typeof message.metadata === 'object' &&
            !Array.isArray(message.metadata)
                ? {
                    ...(message.metadata as Record<string, unknown>),
                }
                : {};
        const metadata = {
            ...existing,
            safety: notice,
        };
        await this.db.orm.public.Message
            .where({ id: message.id })
            .update({
                metadata,
                updatedAt: new Date().toISOString(),
            });
        message.metadata = metadata;
    }

    private toAiRole(
        role: string,
    ): 'user' | 'assistant' | 'system' {
        switch (role) {
            case 'ASSISTANT':
                return 'assistant';

            case 'SYSTEM':
                return 'system';

            case 'USER':
            default:
                return 'user';
        }
    }

    private buildSystemPrompt(
        companion: any,
        personality: any,
        memoryContext = '',
    ): string {
        const sections = [
            'COMPANION IDENTITY',
            `You are ${companion.name}.`,
        ];

        if (companion.relationshipType) {
            sections.push(
                `You are the user's AI ${companion.relationshipType}.`,
            );
        }

        sections.push(
            '',
            'PERSONALITY',
        );

        if (personality) {
            if (personality.traits) {
                sections.push(
                    `Traits: ${JSON.stringify(
                        personality.traits,
                    )}`,
                );
            }

            if (personality.communicationStyle) {
                sections.push(
                    `Communication style: ${personality.communicationStyle}`,
                );
            }

            if (personality.backstory) {
                sections.push(
                    `Backstory: ${personality.backstory}`,
                );
            }
        }

        /*
         * ------------------------------------------------------
         * MEMORY
         * ------------------------------------------------------
         */
        if (memoryContext) {
            sections.push(
                '',
                memoryContext,
            );
        }

        sections.push(
            '',
            'COMMUNICATION RULES',
            'Speak naturally and conversationally.',
            'Do not sound robotic.',
            'Show emotional awareness.',
            'Maintain personality consistency.',
            'Use the current conversation context naturally.',
            'Use relevant memories naturally when they help answer the user.',
            'Do not mention the memory system or memory retrieval.',
            'Do not invent facts about the user.',
            '',
            'SAFETY RULES',
            SAFETY_SYSTEM_RULES,
        );

        return sections.join('\n');
    }

    async *streamResponse(
        userId: string | number,
        conversationId: string | number,
        options: { signal?: AbortSignal } = {},
    ): AsyncGenerator<
        | {
            type: 'delta';
            content: string;
        }
        | {
            type: 'replace';
            content: string;
        }
        | {
            type: 'done';
            message: unknown;
            safety?: SafetyNotice;
        }
    > {
        const numericUserId = Number(userId);
        const numericConversationId =
            Number(conversationId);

        /*
         * ------------------------------------------------------
         * 1. Load conversation
         * ------------------------------------------------------
         */
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

        /*
         * ------------------------------------------------------
         * 2. Load companion
         * ------------------------------------------------------
         */
        const companion =
            await this.db.orm.public.Companion
                .where({
                    id: conversation.companionId,
                    userId: numericUserId,
                    status: 'ACTIVE',
                })
                .first();

        if (!companion) {
            throw new NotFoundException(
                'Companion not found',
            );
        }

        /*
         * ------------------------------------------------------
         * 3. Load personality
         * ------------------------------------------------------
         */
        const personality =
            await this.db.orm.public.CompanionPersonality
                .where({
                    companionId: companion.id,
                })
                .first();

        /*
         * ------------------------------------------------------
         * 4. Load conversation history
         * ------------------------------------------------------
         */
        const messages =
            await this.db.orm.public.Message
                .where({
                    conversationId:
                        numericConversationId,
                    deletedAt: null,
                })
                .orderBy((message: any) =>
                    message.createdAt.desc(),
                )
                .limit(20)
                .all();

        const chronologicalMessages =
            [...messages].reverse();

        /*
         * ------------------------------------------------------
         * 5. Find current user message
         * ------------------------------------------------------
         */
        const currentUserMessage =
            [...chronologicalMessages]
                .reverse()
                .find(
                    (message: any) =>
                        message.role === 'USER' &&
                        message.content?.trim(),
                );

        const inputNotice = await this.moderation.noticeFor(
            currentUserMessage?.content ?? '',
            'input',
            {
                userId: numericUserId,
                conversationId: numericConversationId,
            },
        );

        if (inputNotice) {
            if (options.signal?.aborted) return;
            if (currentUserMessage) {
                await this.flagUserMessage(
                    currentUserMessage,
                    inputNotice,
                );
            }
            if (options.signal?.aborted) return;
            yield {
                type: 'delta',
                content: inputNotice.message,
            };
            if (options.signal?.aborted) return;
            const assistantMessage = await this.finishTurn(
                numericConversationId,
                numericUserId,
                inputNotice.message,
                inputNotice,
                true,
            );
            if (options.signal?.aborted) return;
            yield {
                type: 'done',
                message: assistantMessage,
                safety: inputNotice,
            };
            return;
        }

        /*
         * ------------------------------------------------------
         * 6. Retrieve long-term memory
         * ------------------------------------------------------
         */
        const memoryContext =
            currentUserMessage
                ? await this.memoryContextService
                    .buildContext(
                        numericUserId,
                        companion.id,
                        currentUserMessage.content,
                    )
                : '';

        /*
         * ------------------------------------------------------
         * 7. Build AI context
         * ------------------------------------------------------
         */
        const systemPrompt =
            this.buildSystemPrompt(
                companion,
                personality,
                memoryContext,
            );

        const aiMessages = this.modelMessages(
            systemPrompt,
            chronologicalMessages,
        );

        /*
         * ------------------------------------------------------
         * 8. Stream AI response
         * ------------------------------------------------------
         *
         * Score sentence-sized windows so a safe sentence can
         * leave before the rest of the reply is known. A real block
         * sends one replace event and the rest is dropped. A provider
         * error keeps text the local pre-filter already passed.
         *
         * The reply is persisted only when that loop finishes and
         * the client is still connected. Stop / disconnect aborts
         * `options.signal` and skips the insert.
         */
        const signal = options.signal;
        const outputContext = {
            userId: numericUserId,
            conversationId: numericConversationId,
        };
        let pending = '';
        let safeText = '';
        let outputNotice: SafetyNotice | null = null;

        try {
            for await (
                const chunk of this.chatProvider.streamChat({
                    messages: aiMessages,
                    signal,
                })
            ) {
                if (signal?.aborted) return;
                if (outputNotice) continue;
                pending += chunk;
                while (!outputNotice) {
                    if (signal?.aborted) return;
                    const window = takeReadyWindow(pending);
                    if (!window.ready) {
                        pending = window.rest;
                        break;
                    }
                    pending = window.rest;
                    const notice = await this.moderation.noticeFor(
                        window.ready,
                        'output',
                        outputContext,
                    );
                    if (signal?.aborted) return;
                    if (notice) {
                        outputNotice = notice;
                        yield {
                            type: 'replace',
                            content: notice.message,
                        };
                        break;
                    }
                    safeText += window.ready;
                    yield {
                        type: 'delta',
                        content: window.ready,
                    };
                }
            }
        } catch (error) {
            if (signal?.aborted || isAbortError(error)) return;
            throw error;
        }

        if (signal?.aborted) return;

        if (!outputNotice && pending.trim()) {
            const notice = await this.moderation.noticeFor(
                pending,
                'output',
                outputContext,
            );
            if (signal?.aborted) return;
            if (notice) {
                outputNotice = notice;
                yield {
                    type: 'replace',
                    content: notice.message,
                };
            } else {
                safeText += pending;
                yield {
                    type: 'delta',
                    content: pending,
                };
            }
        }

        if (signal?.aborted) return;

        const streamedContent = outputNotice
            ? outputNotice.message
            : safeText.trim();

        if (!streamedContent) {
            throw new Error(
                'AI provider returned an empty response',
            );
        }

        /*
         * ------------------------------------------------------
         * 9. Persist complete streamed response
         * ------------------------------------------------------
         */
        if (signal?.aborted) return;
        const assistantMessage = await this.finishTurn(
            numericConversationId,
            numericUserId,
            streamedContent,
            outputNotice,
            true,
        );
        if (signal?.aborted) return;

        yield {
            type: 'done',
            message: assistantMessage,
            ...(outputNotice ? { safety: outputNotice } : {}),
        };
    }

    private async finishTurn(
        conversationId: number,
        userId: number,
        content: string,
        notice: SafetyNotice | null,
        persist: boolean,
    ) {
        const metadata = notice ? { safety: notice } : null;

        if (!persist) {
            return {
                content,
                metadata,
            };
        }

        const now = new Date().toISOString();

        const assistantMessage =
            await this.db.orm.public.Message.create({
                conversationId,
                role: 'ASSISTANT',
                type: 'TEXT',
                content,
                metadata,
                audioUrl: null,
                imageUrl: null,
                updatedAt: now,
            });

        await this.db.orm.public.Conversation
            .where({
                id: conversationId,
                userId,
            })
            .update({
                lastMessageAt: now,
                updatedAt: now,
            });

        return assistantMessage;
    }
}