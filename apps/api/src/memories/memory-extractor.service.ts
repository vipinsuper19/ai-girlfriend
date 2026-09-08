import {
    Inject,
    Injectable,
    Logger,
} from '@nestjs/common';

//import { ChatProvider } from '../ai/interfaces/chat-provider.interface.js';
import {
    CHAT_PROVIDER,
} from '../ai/interfaces/chat-provider.interface.js';
import type {
    ChatProvider,
} from '../ai/interfaces/chat-provider.interface.js';
import { MemoryImportanceService } from './memory-importance.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MemoryEmbeddingService } from './memory-embedding.service.js';

type ExtractedMemoryType =
    | 'PROFILE'
    | 'PREFERENCE'
    | 'RELATIONSHIP'
    | 'CONVERSATION'
    | 'FACT';

interface ExtractedMemory {
    content: string;
    type: ExtractedMemoryType;
    importance: number;
    confidence: number;
}

interface MemoryExtractionResponse {
    memories: ExtractedMemory[];
}

@Injectable()
export class MemoryExtractorService {
    private readonly logger =
        new Logger(MemoryExtractorService.name);

    constructor(
        @Inject(CHAT_PROVIDER)
        private readonly chatProvider: ChatProvider,
        private readonly prisma: PrismaService,
        private readonly memoryImportanceService: MemoryImportanceService,
        private readonly memoryEmbeddingService: MemoryEmbeddingService,
    ) { }

    private get db(): any {
        return this.prisma.client;
    }

    async extractFromConversation(
        userId: number,
        companionId: number,
        conversationId: number,
        userMessage: string,
        assistantMessage: string,
    ): Promise<void> {
        if (!userMessage.trim()) {
            return;
        }

        try {
            const response =
                await this.chatProvider.generateChat({
                    messages: [
                        {
                            role: 'system',
                            content: this.getExtractionPrompt(),
                        },
                        {
                            role: 'user',
                            content: JSON.stringify({
                                userMessage,
                                assistantMessage,
                            }),
                        },
                    ],
                });

            const extraction =
                this.parseExtractionResponse(response);

            if (!extraction) {
                return;
            }

            const memories =
                extraction.memories
                    .map((memory) =>
                        this.validateMemory(memory),
                    )
                    .filter(
                        (
                            memory,
                        ): memory is ExtractedMemory =>
                            memory !== null,
                    );

            this.logger.debug(
                `Validated ${memories.length} important memories for conversation ${conversationId}`,
            );

            for (const memory of memories) {
                await this.storeMemory(
                    userId,
                    companionId,
                    conversationId,
                    memory,
                );
            }

            this.logger.debug(
                `Extracted ${memories.length} memories from conversation ${conversationId}`,
            );
        } catch (error) {
            this.logger.error(
                `Memory extraction failed for conversation ${conversationId}`,
                error instanceof Error
                    ? error.stack
                    : undefined,
            );
        }

    }

    private getExtractionPrompt(): string {
        return `
You are a memory extraction system for an AI companion.

Your task is to identify ONLY important, long-term information about the user that should be remembered.

Do not store casual conversation.
Do not store greetings.
Do not store temporary questions.
Do not store information already obvious from the immediate message unless it represents a meaningful user fact.

Extract information such as:

personal profile facts
preferences and dislikes
important relationships
recurring interests
important life facts
meaningful events
information useful for future conversations

Use ONLY these memory types:
PROFILE
PREFERENCE
RELATIONSHIP
CONVERSATION
FACT

Importance is from 1 to 10:
1-3 = low
4-6 = medium
7-8 = high
9-10 = critical

Score every potentially useful memory from 1 to 10.

1-3 = Low
4-6 = Medium
7-8 = High
9-10 = Critical

Low-importance information may be returned for evaluation,
but do not include casual greetings, filler conversation,
or trivial temporary details.

Confidence must be a number from 0 to 1.

Return valid JSON only.

Required format:

{
"memories": [
{
"content": "Concise third-person factual memory about the user",
"type": "PROFILE",
"importance": 8,
"confidence": 0.95
}
]
}

If there is nothing worth remembering:

{
"memories": []
}
`.trim();
    }

    private parseExtractionResponse(
        response: string,
    ): MemoryExtractionResponse | null {
        if (!response || !response.trim()) {
            this.logger.warn(
                'AI returned an empty memory extraction response',
            );

            return null;

        }

        const jsonStart = response.indexOf('{');
        const jsonEnd = response.lastIndexOf('}');

        if (
            jsonStart === -1 ||
            jsonEnd === -1 ||
            jsonEnd <= jsonStart
        ) {
            this.logger.warn(
                'No valid JSON object found in memory extraction response',
            );

            this.logger.debug(
                `Raw AI response:\n${response}`,
            );

            return null;

        }

        const json = response
            .slice(
                jsonStart,
                jsonEnd + 1,
            )
            .trim();

        try {
            const parsed: unknown =
                JSON.parse(json);

            if (
                !parsed ||
                typeof parsed !== 'object'
            ) {
                this.logger.warn(
                    'AI extraction response is not an object',
                );

                return null;
            }

            const value =
                parsed as Record<string, unknown>;

            if (!Array.isArray(value.memories)) {
                this.logger.warn(
                    'AI extraction response does not contain a memories array',
                );

                return null;
            }

            return {
                memories: value.memories as ExtractedMemory[],
            };

        } catch (error) {
            this.logger.error(
                `Failed to parse extracted JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

            this.logger.debug(
                `Extracted JSON:\n${json}`,
            );

            this.logger.debug(
                `Raw AI response:\n${response}`,
            );

            return null;

        }
    }

    private validateMemory(
        memory: unknown,
    ): ExtractedMemory | null {
        if (
            !memory ||
            typeof memory !== 'object'
        ) {
            return null;
        }

        const value =
            memory as Record<string, unknown>;

        const content =
            typeof value.content === 'string'
                ? value.content.trim()
                : '';

        const validTypes: ExtractedMemoryType[] = [
            'PROFILE',
            'PREFERENCE',
            'RELATIONSHIP',
            'CONVERSATION',
            'FACT',
        ];

        const type =
            typeof value.type === 'string' &&
                validTypes.includes(
                    value.type as ExtractedMemoryType,
                )
                ? (value.type as ExtractedMemoryType)
                : null;

        const confidence =
            typeof value.confidence === 'number' &&
                Number.isFinite(value.confidence)
                ? value.confidence
                : 0;

        if (!content || !type) {
            return null;
        }

        if (
            confidence < 0 ||
            confidence > 1
        ) {
            return null;
        }

        const importance =
            this.memoryImportanceService.score(
                value.importance,
            );

        if (!importance.shouldStore) {
            return null;
        }

        return {
            content,
            type,
            importance: importance.score,
            confidence,
        };
    }

    private normalizeMemoryContent(
        content: string,
    ): string {
        return content
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    }

    private async findDuplicateMemory(
        userId: number,
        content: string,
        type: ExtractedMemoryType,
    ) {
        const normalizedContent =
            this.normalizeMemoryContent(content);

        const db = this.prisma.client as any;

        const memories = await db.orm.public.Memory
            .where({
                userId,
                type,
            })
            .all();

        return (
            memories.find(
                (memory: any) =>
                    this.normalizeMemoryContent(
                        memory.content,
                    ) === normalizedContent,
            ) ?? null
        );
    }

    private async storeMemory(
        userId: number,
        companionId: number,
        conversationId: number,
        memory: ExtractedMemory,
    ): Promise<void> {

        const existingMemory =
            await this.findDuplicateMemory(
                userId,
                memory.content,
                memory.type,
            );

        if (existingMemory) {
            this.logger.debug(
                `Duplicate memory skipped for user ${userId}: ${memory.content}`
            );

            return existingMemory;
        }

        const now = new Date().toISOString();

        const createdMemory = await this.db.orm.public.Memory.create({
            userId,
            companionId,
            conversationId,
            type: memory.type,
            status: 'ACTIVE',
            source: 'AI_EXTRACTION',
            content: memory.content,
            metadata: null,
            importance: memory.importance,
            confidence: memory.confidence,
            accessCount: 0,
            lastAccessedAt: null,
            expiresAt: null,
            updatedAt: now,
            deletedAt: null,
        });

        void this.memoryEmbeddingService.generateForMemory(
            createdMemory.id,
            memory.content,
        );

    }
}