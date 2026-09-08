import {
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { MemoryContextService } from '../memories/memory-context.service.js';

import {
    CHAT_PROVIDER,
    type AiChatMessage,
    type ChatProvider,
} from './interfaces/chat-provider.interface.js';

@Injectable()
export class AiService {
    constructor(
        private readonly prisma: PrismaService,

        @Inject(CHAT_PROVIDER)
        private readonly chatProvider: ChatProvider,

        private readonly memoryContextService:
            MemoryContextService,
    ) { }

    private get db(): any {
        return this.prisma.client;
    }

    async generateResponse(
        userId: string | number,
        conversationId: string | number,
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

        const aiMessages: AiChatMessage[] = [
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
                        ),
                )
                .map((message: any) => ({
                    role: this.toAiRole(
                        message.role,
                    ),
                    content:
                        message.content as string,
                })),
        ];

        /*
         * ------------------------------------------------------
         * 8. Generate AI response
         * ------------------------------------------------------
         */
        const responseText =
            await this.chatProvider.generateChat({
                messages: aiMessages,
            });

        /*
         * ------------------------------------------------------
         * 9. Persist assistant response
         * ------------------------------------------------------
         */
        const now =
            new Date().toISOString();

        const assistantMessage =
            await this.db.orm.public.Message.create({
                conversationId:
                    numericConversationId,
                role: 'ASSISTANT',
                type: 'TEXT',
                content: responseText,
                metadata: null,
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

        return assistantMessage;
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
        );

        return sections.join('\n');
    }

    async *streamResponse(
        userId: string | number,
        conversationId: string | number,
    ): AsyncGenerator<
        | {
            type: 'delta';
            content: string;
        }
        | {
            type: 'done';
            message: unknown;
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

        const aiMessages: AiChatMessage[] = [
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
                        ),
                )
                .map((message: any) => ({
                    role: this.toAiRole(
                        message.role,
                    ),
                    content:
                        message.content as string,
                })),
        ];

        /*
         * ------------------------------------------------------
         * 8. Stream AI response
         * ------------------------------------------------------
         */
        let fullResponse = '';

        for await (
            const chunk of this.chatProvider.streamChat({
                messages: aiMessages,
            })
        ) {
            fullResponse += chunk;

            yield {
                type: 'delta',
                content: chunk,
            };
        }

        if (!fullResponse.trim()) {
            throw new Error(
                'AI provider returned an empty response',
            );
        }

        /*
         * ------------------------------------------------------
         * 9. Persist complete streamed response
         * ------------------------------------------------------
         */
        const now =
            new Date().toISOString();

        const assistantMessage =
            await this.db.orm.public.Message.create({
                conversationId:
                    numericConversationId,
                role: 'ASSISTANT',
                type: 'TEXT',
                content: fullResponse.trim(),
                metadata: null,
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

        yield {
            type: 'done',
            message: assistantMessage,
        };
    }
}