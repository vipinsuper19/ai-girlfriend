import { Inject, Injectable, Logger } from '@nestjs/common';

import { EMBEDDING_PROVIDER } from '../ai/interfaces/embedding.provider.js';
import type { EmbeddingProvider } from '../ai/interfaces/embedding.provider.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface RelevantMemory {
    id: number;
    content: string;
    type: string;
    importance: number;
    confidence: number;
    similarity: number;
}

@Injectable()
export class MemorySearchService {
    private readonly logger = new Logger(MemorySearchService.name);

    private readonly expectedDimensions = 1536;
    private readonly minimumImportance = 4;
    private readonly defaultLimit = 5;

    constructor(
        @Inject(EMBEDDING_PROVIDER)
        private readonly embeddingProvider: EmbeddingProvider,
        private readonly prisma: PrismaService,
    ) { }

    async searchRelevantMemories(
        userId: number,
        companionId: number,
        query: string,
        limit = this.defaultLimit,
    ): Promise<RelevantMemory[]> {
        const text = query.trim();

        if (!text) {
            return [];
        }

        const safeLimit = Math.min(
            Math.max(Math.floor(limit), 1),
            20,
        );

        try {
            /*
             * ---------------------------------------------------------
             * 1. Generate embedding for the search query
             * ---------------------------------------------------------
             */
            const embeddingResult =
                await this.embeddingProvider.generateEmbedding(text);

            if (
                !embeddingResult.embedding ||
                embeddingResult.embedding.length !== this.expectedDimensions
            ) {
                throw new Error(
                    `Invalid embedding dimensions. Expected ${this.expectedDimensions}, received ${embeddingResult.embedding?.length ?? 0
                    }.`,
                );
            }

            /*
             * ---------------------------------------------------------
             * 2. Get Prisma PostgreSQL client
             * ---------------------------------------------------------
             */
            const db = this.prisma.client as any;

            const memory = db.sql.public.memory.as('m');
            const memoryEmbedding =
                db.sql.public.memoryEmbedding.as('me');

            const plan = memory
                .innerJoin(
                    memoryEmbedding,
                    (f: any, fns: any) =>
                        fns.eq(
                            f.m.id,
                            f.me.memoryId,
                        ),
                )

                .select((f: any, fns: any) => ({
                    id: f.m.id,
                    content: f.m.content,
                    type: f.m.type,
                    importance: f.m.importance,
                    confidence: f.m.confidence,

                    distance: fns.cosineDistance(
                        f.me.embedding,
                        embeddingResult.embedding,
                    ),
                }))

                .where(
                    (f: any, fns: any) =>
                        fns.eq(
                            f.m.userId,
                            userId,
                        ),
                )

                .where(
                    (f: any, fns: any) =>
                        fns.eq(
                            f.m.companionId,
                            companionId,
                        ),
                )

                .where(
                    (f: any, fns: any) =>
                        fns.eq(
                            f.m.status,
                            'ACTIVE',
                        ),
                )

                .where(
                    (f: any, fns: any) =>
                        fns.eq(
                            f.me.status,
                            'READY',
                        ),
                )

                .where(
                    (f: any, fns: any) =>
                        fns.gte(
                            f.m.importance,
                            this.minimumImportance,
                        ),
                )

                .where(
                    (f: any, fns: any) =>
                        fns.raw`
        ${f.m.deletedAt} IS NULL
      `.returns('pg/bool@1'),
                )

                .where(
                    (f: any, fns: any) =>
                        fns.raw`
        (
          ${f.m.expiresAt} IS NULL
          OR ${f.m.expiresAt} > CURRENT_TIMESTAMP
        )
      `.returns('pg/bool@1'),
                )

                .orderBy(
                    (f: any, fns: any) =>
                        fns.cosineDistance(
                            f.me.embedding,
                            embeddingResult.embedding,
                        ),
                    {
                        direction: 'asc',
                    },
                )

                .limit(safeLimit)

                .build();

            /*
             * ---------------------------------------------------------
             * 9. Execute SELECT plan
             * ---------------------------------------------------------
             *
             * PostgreSQL Prisma 8:
             *
             *   db.runtime()
             *       ↓
             *   runtime.execute(plan)
             *       ↓
             *   Row[]
             */
            const runtime = db.runtime();

            const rows = await runtime.query(plan);

            /*
             * ---------------------------------------------------------
             * 10. Convert distance to similarity
             * ---------------------------------------------------------
             */
            return rows.map((row: any) => {
                const distance = Number(row.distance);

                return {
                    id: Number(row.id),
                    content: String(row.content),
                    type: String(row.type),
                    importance: Number(row.importance),
                    confidence: Number(row.confidence),
                    similarity: Math.max(
                        0,
                        Math.min(1, 1 - distance),
                    ),
                };
            });
        } catch (error) {
            this.logger.error(
                `Failed to search relevant memories for user ${userId}, companion ${companionId}`,
                error instanceof Error
                    ? error.stack
                    : String(error),
            );

            /*
             * Memory search must never break chat.
             */
            return [];
        }
    }
}