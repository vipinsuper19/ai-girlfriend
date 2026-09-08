import { Injectable, Logger } from '@nestjs/common';

import {
    MemorySearchService,
    type RelevantMemory,
} from './memory-search.service.js';

@Injectable()
export class MemoryContextService {
    private readonly logger = new Logger(
        MemoryContextService.name,
    );

    private readonly maxMemories = 5;

    /**
     * Semantic similarity threshold.
     *
     * MemorySearchService already handles:
     * - user ownership
     * - companion ownership
     * - ACTIVE memory status
     * - READY embeddings
     * - minimum importance
     *
     * This threshold prevents weak semantic matches from
     * being injected into the model context.
     */
    private readonly minimumSimilarity = 0.55;

    constructor(
        private readonly memorySearchService: MemorySearchService,
    ) { }

    async buildContext(
        userId: number,
        companionId: number,
        userMessage: string,
    ): Promise<string> {
        const text = userMessage.trim();

        if (!text) {
            return '';
        }

        try {
            const memories =
                await this.memorySearchService
                    .searchRelevantMemories(
                        userId,
                        companionId,
                        text,
                        this.maxMemories,
                    );

            const relevantMemories =
                memories
                    .filter(
                        (memory) =>
                            memory.similarity >=
                            this.minimumSimilarity,
                    )
                    .slice(0, this.maxMemories);

            if (relevantMemories.length === 0) {
                return '';
            }

            return this.formatMemoryContext(
                relevantMemories,
            );
        } catch (error) {
            /*
             * Long-term memory must never make chat fail.
             */
            this.logger.warn(
                `Memory retrieval failed: ${error instanceof Error
                    ? error.message
                    : String(error)
                }`,
            );

            return '';
        }
    }

    private formatMemoryContext(
        memories: RelevantMemory[],
    ): string {
        const memoryLines = memories.map(
            (memory) =>
                `- ${memory.content}`,
        );

        return [
            'MEMORY',
            'Use the following relevant memories about the user when appropriate.',
            'Use them naturally and conversationally.',
            'Do not mention the memory system or retrieval process.',
            'Do not list memories mechanically.',
            'Do not invent facts that are not contained in the memories.',
            '',
            ...memoryLines,
        ].join('\n');
    }
}