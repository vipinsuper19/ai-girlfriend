import {
    Inject,
    Injectable,
    Logger,
} from '@nestjs/common';

import {
    EMBEDDING_PROVIDER,
} from '../ai/interfaces/embedding.provider.js';

import type {
    EmbeddingProvider,
} from '../ai/interfaces/embedding.provider.js';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class MemoryEmbeddingService {
    private readonly logger =
        new Logger(MemoryEmbeddingService.name);

    private readonly expectedDimensions =
        1536;

    constructor(
        @Inject(EMBEDDING_PROVIDER)
        private readonly embeddingProvider: EmbeddingProvider,

        private readonly prisma: PrismaService,

    ) { }

    async generateForMemory(
        memoryId: number,
        content: string,
        options: { replace?: boolean } = {},
    ): Promise<void> {
        const text = content.trim();

        if (!text) {
            this.logger.warn(
                `Skipping embedding generation for memory ${memoryId}: empty content`,
            );

            return;
        }

        const db = this.prisma.client as any;
        const embeddingTable =
            db.orm.public.MemoryEmbedding;

        try {
            const existingEmbedding =
                await embeddingTable
                    .where({
                        memoryId,
                    })
                    .first();

            /*
             * If an embedding already exists and is READY,
             * do not generate it again.
             */
            if (
                existingEmbedding &&
                existingEmbedding.status === 'READY' &&
                !options.replace
            ) {
                this.logger.debug(
                    `Embedding already exists for memory ${memoryId}`,
                );

                return;
            }

            /*
             * Create the PENDING record only if it does not
             * already exist.
             */
            if (!existingEmbedding) {
                await embeddingTable.create({
                    memoryId,
                    provider: 'GEMINI',
                    model: 'gemini-embedding-001',
                    dimensions: this.expectedDimensions,
                    status: 'PENDING',
                    embedding: null,
                    updatedAt: new Date().toISOString(),
                });
            } else if (
                existingEmbedding.status === 'FAILED' ||
                options.replace
            ) {
                /*
                 * Allow retrying previously failed embeddings.
                 */
                await embeddingTable
                    .where({
                        memoryId,
                    })
                    .update({
                        status: 'PENDING',
                        updatedAt:
                            new Date().toISOString(),
                    });
            }

            const result =
                await this.embeddingProvider.generateEmbedding(
                    text,
                );

            if (
                !Array.isArray(result.embedding)
            ) {
                throw new Error(
                    'Embedding provider returned an invalid embedding vector',
                );
            }

            if (
                result.dimensions !==
                this.expectedDimensions
            ) {
                throw new Error(
                    `Invalid embedding dimensions. Expected ${this.expectedDimensions}, received ${result.dimensions}`,
                );
            }

            if (
                result.embedding.length !==
                this.expectedDimensions
            ) {
                throw new Error(
                    `Invalid embedding vector length. Expected ${this.expectedDimensions}, received ${result.embedding.length}`,
                );
            }

            /*
             * Verify every vector value is a valid number.
             */
            const isValidVector =
                result.embedding.every(
                    (value) =>
                        typeof value === 'number' &&
                        Number.isFinite(value),
                );

            if (!isValidVector) {
                throw new Error(
                    'Embedding vector contains invalid values',
                );
            }

            /*
             * Store the generated vector and mark it READY.
             */
            await embeddingTable
                .where({
                    memoryId,
                })
                .update({
                    provider: result.provider,
                    model: result.model,
                    dimensions: result.dimensions,
                    status: 'READY',
                    embedding: result.embedding,
                    updatedAt:
                        new Date().toISOString(),
                });

            this.logger.log(
                `Embedding generated successfully for memory ${memoryId}`,
            );
        } catch (error) {
            this.logger.error(
                `Embedding generation failed for memory ${memoryId}`,
                error instanceof Error
                    ? error.stack
                    : String(error),
            );

            try {
                const existingEmbedding =
                    await embeddingTable
                        .where({
                            memoryId,
                        })
                        .first();

                if (existingEmbedding) {
                    await embeddingTable
                        .where({
                            memoryId,
                        })
                        .update({
                            status: 'FAILED',
                            updatedAt:
                                new Date().toISOString(),
                        });
                }
            } catch (updateError) {
                this.logger.error(
                    `Failed to update embedding status to FAILED for memory ${memoryId}`,
                    updateError instanceof Error
                        ? updateError.stack
                        : String(updateError),
                );
            }
        }

    }
}