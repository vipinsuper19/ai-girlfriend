import {
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateReportDto } from './dto/create-report.dto.js';
import { isUniqueViolation } from './unique-violation.js';

export type StoredReport = {
    id: number;
    created: boolean;
};

@Injectable()
export class ReportsService {
    constructor(private readonly prisma: PrismaService) { }

    private get db(): any {
        return this.prisma.client;
    }

    /**
     * Files a report for a message the caller owns.
     * A second report of the same message by the same person returns the
     * existing row (`created: false`) instead of inserting another.
     */
    async create(userId: number, dto: CreateReportDto): Promise<StoredReport> {
        if (!Number.isInteger(userId) || userId <= 0) {
            throw new NotFoundException('Message not found');
        }

        const message = await this.db.orm.public.Message
            .where({ id: dto.messageId, deletedAt: null })
            .first();

        if (!message || message.conversationId !== dto.conversationId) {
            throw new NotFoundException('Message not found');
        }

        const conversation = await this.db.orm.public.Conversation
            .where({
                id: dto.conversationId,
                userId,
                deletedAt: null,
            })
            .first();

        if (!conversation) {
            throw new NotFoundException('Message not found');
        }

        const existing = await this.db.orm.public.MessageReport
            .where({ userId, messageId: dto.messageId })
            .first();

        if (existing) {
            return { id: existing.id, created: false };
        }

        try {
            const created = await this.db.orm.public.MessageReport.create({
                userId,
                messageId: dto.messageId,
                conversationId: dto.conversationId,
                reason: dto.reason,
                note: dto.note ?? null,
                content: message.content ?? null,
                status: 'PENDING',
                updatedAt: new Date().toISOString(),
            });

            return { id: created.id, created: true };
        } catch (error) {
            if (!isUniqueViolation(error)) throw error;

            const raced = await this.db.orm.public.MessageReport
                .where({ userId, messageId: dto.messageId })
                .first();

            if (!raced) throw error;
            return { id: raced.id, created: false };
        }
    }
}
