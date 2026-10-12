import assert from 'node:assert/strict';
import test from 'node:test';

import { NotFoundException } from '@nestjs/common';

import type { CreateReportDto } from './dto/create-report.dto.js';
import { ReportsService } from './reports.service.js';
import { isUniqueViolation } from './unique-violation.js';

type MessageRow = {
    id: number;
    conversationId: number;
    content: string | null;
    deletedAt: string | null;
};

type ConversationRow = {
    id: number;
    userId: number;
    deletedAt: string | null;
};

type ReportRow = {
    id: number;
    userId: number;
    messageId: number;
    conversationId: number;
    reason: string;
    note: string | null;
    content: string | null;
    status: string;
    updatedAt: string;
};

function matches(row: object, filter: Record<string, unknown>) {
    return Object.entries(filter).every(([key, value]) => (row as Record<string, unknown>)[key] === value);
}

function fakeDb(options?: { failNextCreate?: boolean }) {
    const messages: MessageRow[] = [
        { id: 12, conversationId: 8, content: 'hello there', deletedAt: null },
        { id: 13, conversationId: 8, content: null, deletedAt: null },
        { id: 14, conversationId: 9, content: 'other chat', deletedAt: null },
        { id: 15, conversationId: 8, content: 'gone', deletedAt: '2026-10-01T00:00:00.000Z' },
    ];
    const conversations: ConversationRow[] = [
        { id: 8, userId: 3, deletedAt: null },
        { id: 9, userId: 4, deletedAt: null },
    ];
    const reports: ReportRow[] = [];
    let failNextCreate = options?.failNextCreate ?? false;

    const table = <T extends object>(rows: T[]) => ({
        where(filter: Record<string, unknown>) {
            return {
                async first() {
                    return rows.find((row) => matches(row, filter)) ?? null;
                },
            };
        },
    });

    const client = {
        orm: {
            public: {
                Message: table(messages),
                Conversation: table(conversations),
                MessageReport: {
                    ...table(reports),
                    async create(data: Omit<ReportRow, 'id'>) {
                        if (failNextCreate) {
                            failNextCreate = false;
                            reports.push({ ...data, id: 50 });
                            const error = new Error('duplicate key value violates unique constraint');
                            (error as { code?: string }).code = '23505';
                            throw error;
                        }
                        const duplicate = reports.find(
                            (row) => row.userId === data.userId && row.messageId === data.messageId,
                        );
                        if (duplicate) {
                            const error = new Error('duplicate key value violates unique constraint');
                            (error as { code?: string }).code = '23505';
                            throw error;
                        }
                        const created = { ...data, id: reports.length + 1 };
                        reports.push(created);
                        return created;
                    },
                },
            },
        },
    };

    return { client, reports };
}

function serviceFor(db: { client: unknown }) {
    return new ReportsService({ client: db.client } as never);
}

const body = {
    messageId: 12,
    conversationId: 8,
    reason: 'HARMFUL',
    note: 'unsafe',
} as CreateReportDto;

test('stores a snapshot and reports the new id', async () => {
    const db = fakeDb();
    const result = await serviceFor(db).create(3, body);

    assert.deepEqual(result, { id: 1, created: true });
    assert.equal(db.reports.length, 1);
    assert.equal(db.reports[0]?.content, 'hello there');
    assert.equal(db.reports[0]?.reason, 'HARMFUL');
    assert.equal(db.reports[0]?.note, 'unsafe');
    assert.equal(db.reports[0]?.status, 'PENDING');
    assert.equal(db.reports[0]?.userId, 3);
    assert.equal(db.reports[0]?.messageId, 12);
    assert.equal(db.reports[0]?.conversationId, 8);
});

test('returns the existing id when the same person reports the message again', async () => {
    const db = fakeDb();
    const reports = serviceFor(db);
    const first = await reports.create(3, body);
    const second = await reports.create(3, {
        ...body,
        reason: 'HATE',
        note: undefined,
    });

    assert.equal(first.created, true);
    assert.deepEqual(second, { id: first.id, created: false });
    assert.equal(db.reports.length, 1);
    assert.equal(db.reports[0]?.reason, 'HARMFUL');
});

test('a concurrent unique violation resolves to the stored report', async () => {
    const db = fakeDb({ failNextCreate: true });
    const result = await serviceFor(db).create(3, body);

    assert.deepEqual(result, { id: 50, created: false });
    assert.equal(db.reports.length, 1);
});

test('someone else cannot report a message they do not own', async () => {
    const db = fakeDb();
    await assert.rejects(
        () => serviceFor(db).create(4, body),
        NotFoundException,
    );
    assert.equal(db.reports.length, 0);
});

test('missing, deleted, mismatched, and unowned messages are not found', async () => {
    const db = fakeDb();
    const reports = serviceFor(db);
    const cases: CreateReportDto[] = [
        { ...body, messageId: 99 },
        { ...body, messageId: 15 },
        { ...body, messageId: 14, conversationId: 8 },
        { ...body, conversationId: 9 },
        { ...body, messageId: 14, conversationId: 9 },
    ];

    for (const dto of cases) {
        await assert.rejects(
            () => reports.create(3, dto),
            (error: unknown) => error instanceof NotFoundException && error.message === 'Message not found',
        );
    }

    await assert.rejects(
        () => reports.create(Number.NaN, body),
        NotFoundException,
    );
    assert.equal(db.reports.length, 0);
});

test('keeps a null content snapshot', async () => {
    const db = fakeDb();
    await serviceFor(db).create(3, { ...body, messageId: 13 });
    assert.equal(db.reports[0]?.content, null);
    assert.equal(db.reports[0]?.note, 'unsafe');
});

test('recognizes a wrapped unique violation and ignores other errors', () => {
    assert.equal(isUniqueViolation(Object.assign(new Error('duplicate key'), { code: '23505' })), true);
    assert.equal(
        isUniqueViolation({ cause: { message: 'unique constraint "messageReport_userId_messageId" failed' } }),
        true,
    );
    assert.equal(isUniqueViolation(new Error('connection reset')), false);
    assert.equal(isUniqueViolation(null), false);
});
