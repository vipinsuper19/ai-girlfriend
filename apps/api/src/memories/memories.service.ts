import {
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { ListMemoriesDto } from './dto/list-memories.dto.js';
import { UpdateMemoryDto } from './dto/update-memory.dto.js';
import { MemorySearchService } from './memory-search.service.js';

@Injectable()
export class MemoriesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly memorySearchService: MemorySearchService,
    ) { }

    private get db(): any {
        return this.prisma.client;
    }

    async findAll(
        userId: string | number,
        query: ListMemoriesDto,
    ) {
        const numericUserId = Number(userId);

        const embMemories =
            await this.memorySearchService.searchRelevantMemories(
                numericUserId,
                query.companionId ?? 1,
                'Where should I travel for a mountain vacation?',
            );

        console.log(embMemories);


        const memories =
            await this.db.orm.public.Memory
                .where({
                    userId: numericUserId,
                    status: 'ACTIVE',
                    deletedAt: null,
                })
                .orderBy((memory: any) =>
                    memory.importance.desc(),
                )
                .limit(query.limit ?? 50)
                .all();

        return memories.filter((memory: any) => {
            if (
                query.type &&
                memory.type !== query.type
            ) {
                return false;
            }

            if (
                query.companionId &&
                memory.companionId !==
                Number(query.companionId)
            ) {
                return false;
            }

            if (
                query.conversationId &&
                memory.conversationId !==
                Number(query.conversationId)
            ) {
                return false;
            }

            return true;
        });

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

        await this.findOne(
            numericUserId,
            numericMemoryId,
        );

        const data: Record<string, unknown> = {};

        if (dto.content !== undefined) {
            const content = dto.content.trim();

            if (!content) {
                throw new NotFoundException(
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

        return this.db.orm.public.Memory
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