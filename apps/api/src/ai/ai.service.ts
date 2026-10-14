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
    assessLocal,
    companionSafetyRules,
    hiddenFromModel,
    personaText,
    priorUserTexts,
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

        const guarded = await this.guardInput(
            conversation,
            companion.id,
            numericUserId,
            numericConversationId,
            currentUserMessage,
            chronologicalMessages,
            companionPersonaText(companion, personality),
        );

        if (guarded.notice) {
            if (currentUserMessage) {
                await this.flagUserMessage(
                    currentUserMessage,
                    guarded.notice,
                );
            }
            return this.finishTurn(
                numericConversationId,
                numericUserId,
                guarded.notice.message,
                guarded.notice,
                options.persistMessage ?? true,
            );
        }

        /*
         * ------------------------------------------------------
         * 6. Retrieve relevant long-term memories
         * ------------------------------------------------------
         */
        const memoryContext = guarded.memoryContext;

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

        const guarded = await this.guardInput(
            conversation,
            companion.id,
            numericUserId,
            numericConversationId,
            currentUserMessage,
            chronologicalMessages,
            companionPersonaText(companion, personality),
        );

        if (guarded.notice) {
            if (options.signal?.aborted) return;
            if (currentUserMessage) {
                await this.flagUserMessage(
                    currentUserMessage,
                    guarded.notice,
                );
            }
            if (options.signal?.aborted) return;
            yield {
                type: 'delta',
                content: guarded.notice.message,
            };
            if (options.signal?.aborted) return;
            const assistantMessage = await this.finishTurn(
                numericConversationId,
                numericUserId,
                guarded.notice.message,
                guarded.notice,
                true,
            );
            if (options.signal?.aborted) return;
            yield {
                type: 'done',
                message: assistantMessage,
                safety: guarded.notice,
            };
            return;
        }

        /*
         * ------------------------------------------------------
         * 6. Retrieve long-term memory
         * ------------------------------------------------------
         */
        const memoryContext = guarded.memoryContext;

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
        // A replaced reply is shown as the refusal (one SSE replace event) and
        // is not stored, so a reload cannot surface the withdrawn prefix.
        const stored = outputNotice
            ? null
            : await this.finishTurn(
                numericConversationId,
                numericUserId,
                streamedContent,
                null,
                true,
            );
        if (signal?.aborted) return;

        const assistantMessage = outputNotice
            ? {
                ...(stored ?? {
                    role: 'ASSISTANT',
                    type: 'TEXT',
                    audioUrl: null,
                    imageUrl: null,
                }),
                content: streamedContent,
                metadata: { safety: outputNotice },
            }
            : stored;

        yield {
            type: 'done',
            message: assistantMessage,
            ...(outputNotice ? { safety: outputNotice } : {}),
        };
    }

    /**
     * Local crisis skips memory search. Everything else is one classifier
     * call that also scores the memory lines. A minor result is stored on
     * the user and the conversation until it is cleared.
     */
    private async guardInput(
        conversation: { id: number; minorHeldAt?: string | null },
        companionId: number,
        userId: number,
        conversationId: number,
        current: { id?: unknown; content?: unknown; metadata?: unknown } | undefined,
        chronologicalMessages: readonly { role?: unknown; content?: unknown; metadata?: unknown }[],
        persona = '',
    ): Promise<{ notice: SafetyNotice | null; memoryContext: string }> {
        const text = typeof current?.content === 'string' ? current.content : '';
        const heldMinor = await this.minorHoldActive(conversation, userId);
        const priorTexts = priorUserTexts(chronologicalMessages, current);
        const crisis = assessLocal(text, 'input').includes('self_harm');
        const found = crisis
            ? []
            : await this.memoryContextService.candidates(userId, companionId, text);
        const turn = await this.moderation.moderateTurn({
            text,
            memories: found.map((memory) => ({
                id: String(memory.id),
                content: memory.content,
            })),
            ctx: {
                userId,
                conversationId,
                priorTexts,
                heldMinor,
                ...(persona ? { personaText: persona } : {}),
            },
        });
        if (turn.holdMinor) await this.persistMinorHold(conversation, userId);
        const allowed = new Set(turn.allowedMemoryIds);
        const kept = found.filter((memory) => allowed.has(String(memory.id)));
        const memoryContext = kept.length === 0
            ? ''
            : this.memoryContextService.formatMemoryContext(kept);
        return { notice: turn.notice, memoryContext };
    }

    private async minorHoldActive(
        conversation: { minorHeldAt?: string | null },
        userId: number,
    ): Promise<boolean> {
        if (conversation.minorHeldAt) return true;
        const users = this.db.orm.public.User;
        if (!users?.where) return false;
        const user = await users.where({ id: userId }).first();
        return Boolean(user?.minorHeldAt);
    }

    private async persistMinorHold(
        conversation: { id: number; minorHeldAt?: string | null },
        userId: number,
    ): Promise<void> {
        const now = new Date().toISOString();
        if (!conversation.minorHeldAt) {
            await this.db.orm.public.Conversation
                .where({ id: conversation.id, userId })
                .update({ minorHeldAt: now, updatedAt: now });
            conversation.minorHeldAt = now;
        }
        const users = this.db.orm.public.User;
        if (!users?.where) return;
        const user = await users.where({ id: userId }).first();
        if (user?.minorHeldAt) return;
        await users.where({ id: userId }).update({
            minorHeldAt: now,
            updatedAt: now,
        });
    }

    private async finishTurn(
        conversationId: number,
        userId: number,
        content: string,
        notice: SafetyNotice | null,
        persist: boolean,
    ) {
        const metadata = notice ? { safety: notice } : null;

        // Canned refusals and transient safety replies are shown, not stored.
        if (!persist || notice) {
            return {
                role: 'ASSISTANT',
                type: 'TEXT',
                content,
                metadata,
                audioUrl: null,
                imageUrl: null,
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

/** Persona text for the filtered-classifier minor check. Missing fields are skipped. */
function companionPersonaText(companion: any, personality: any): string {
    return personaText({
        name: companion?.name,
        systemPrompt: personality?.systemPrompt ?? companion?.systemPrompt,
        greeting: personality?.greeting ?? companion?.greeting,
        personality: {
            traits: personality?.traits,
            interests: personality?.interests,
            likes: personality?.likes,
            dislikes: personality?.dislikes,
            communicationStyle: personality?.communicationStyle,
        },
        appearance: {
            age: companion?.age ?? personality?.age,
            imagePrompt: companion?.imagePrompt ?? personality?.imagePrompt,
        },
    });
}
