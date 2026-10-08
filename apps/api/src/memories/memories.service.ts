import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateMemoryDto } from './dto/create-memory.dto.js';
import { ListMemoriesDto } from './dto/list-memories.dto.js';
import { UpdateMemoryDto } from './dto/update-memory.dto.js';
import { MemoryEmbeddingService } from './memory-embedding.service.js';
import { memoryListWhere, needsReembedding } from './memory-list.js';

const USER_MEMORY_IMPORTANCE = 7;

@Injectable()
export class MemoriesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly memoryEmbeddingService: MemoryEmbeddingService,
    ) { }

    private get db(): any {
        return this.prisma.client;
    }

    async findAll(
        userId: string | number,
        query: ListMemoriesDto,
    ) {
        return this.db.orm.public.Memory
            .where(memoryListWhere(userId, query))
            .orderBy((memory: any) =>
                memory.importance.desc(),
            )
            .limit(query.limit ?? 50)
            .all();
    }

    /** A memory the user wrote herself. She treats it like one she noticed. */
    async create(
        userId: string | number,
        dto: CreateMemoryDto,
    ) {
        const numericUserId = Number(userId);

        const companion =
            await this.db.orm.public.Companion
                .where({
                    id: dto.companionId,
                    userId: numericUserId,
                    status: 'ACTIVE',
                })
                .first();

        if (!companion) {
            throw new NotFoundException(
                'Companion not found',
            );
        }

        const now = new Date().toISOString();
        const content = dto.content.trim();

        const memory = await this.db.orm.public.Memory.create({
            userId: numericUserId,
            companionId: dto.companionId,
            conversationId: null,
            type: dto.type,
            status: 'ACTIVE',
            source: 'USER_INPUT',
            content,
            metadata: null,
            importance: dto.importance ?? USER_MEMORY_IMPORTANCE,
            confidence: 1,
            accessCount: 0,
            lastAccessedAt: null,
            expiresAt: null,
            updatedAt: now,
            deletedAt: null,
        });

        void this.memoryEmbeddingService.generateForMemory(
            memory.id,
            content,
        );

        return memory;
    }

    async findOne(
        userId: string | number,
        memoryId: string | number,
    ) {
        const numericUserId = Number(userId);
        const numericMemoryId = Number(memoryId);

        const memory =
            await this.db.orm.public.Memory
                .where({
                    id: numericMemoryId,
                    userId: numericUserId,
                    status: 'ACTIVE',
                    deletedAt: null,
                })
                .first();

        if (!memory) {
            throw new NotFoundException(
                'Memory not found',
            );
        }

        return memory;

    }

    async update(
        userId: string | number,
        memoryId: string | number,
        dto: UpdateMemoryDto,
    ) {
        const numericUserId = Number(userId);
        const numericMemoryId = Number(memoryId);

        const existing = await this.findOne(
            numericUserId,
            numericMemoryId,
        );

        const data: Record<string, unknown> = {};

        if (dto.content !== undefined) {
            const content = dto.content.trim();

            if (!content) {
                throw new BadRequestException(
                    'Memory content cannot be empty',
                );
            }

            data['content'] = content;
        }

        if (dto.type !== undefined) {
            data['type'] = dto.type;
        }

        if (dto.importance !== undefined) {
            data['importance'] = dto.importance;
        }

        if (dto.confidence !== undefined) {
            data['confidence'] = dto.confidence;
        }

        if (dto.expiresAt !== undefined) {
            data['expiresAt'] =
                dto.expiresAt || null;
        }

        if (Object.keys(data).length === 0) {
            return this.findOne(
                numericUserId,
                numericMemoryId,
            );
        }

        const now = new Date().toISOString();

        const updated = await this.db.orm.public.Memory
            .where({
                id: numericMemoryId,
                userId: numericUserId,
                status: 'ACTIVE',
                deletedAt: null,
            })
            .update({
                ...data,
                updatedAt: now,
            });

        const content = data['content'] as string | undefined;
        if (needsReembedding(existing.content, content)) {
            void this.memoryEmbeddingService.generateForMemory(
                numericMemoryId,
                content as string,
                { replace: true },
            );
        }

        return updated;
    }

    async removeAll(
        userId: string | number,
        companionId?: number,
    ) {
        const where: Record<string, unknown> = {
            userId: Number(userId),
            status: 'ACTIVE',
            deletedAt: null,
        };

        if (companionId != null) {
            where.companionId = companionId;
        }

        const rows =
            await this.db.orm.public.Memory
                .where(where)
                .all();

        if (rows.length === 0) {
            return { deleted: 0 };
        }

        const now = new Date().toISOString();

        await this.db.orm.public.Memory
            .where(where)
            .update({
                status: 'DELETED',
                deletedAt: now,
                updatedAt: now,
            });

        return { deleted: rows.length };
    }

    async remove(
        userId: string | number,
        memoryId: string | number,
    ) {
        const numericUserId = Number(userId);
        const numericMemoryId = Number(memoryId);

        await this.findOne(
            numericUserId,
            numericMemoryId,
        );

        const now = new Date().toISOString();

        await this.db.orm.public.Memory
            .where({
                id: numericMemoryId,
                userId: numericUserId,
                deletedAt: null,
            })
            .update({
                status: 'DELETED',
                deletedAt: now,
                updatedAt: now,
            });

        return {
            id: numericMemoryId,
            deleted: true,
        };

    }
}