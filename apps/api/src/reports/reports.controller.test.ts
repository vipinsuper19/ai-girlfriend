import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import type { CreateReportDto } from './dto/create-report.dto.js';
import { ReportsController } from './reports.controller.js';
import type { ReportsService } from './reports.service.js';

function responseCapture() {
    const sent: Array<{ status: number; body: Record<string, unknown> }> = [];
    return {
        sent,
        request: { originalUrl: '/api/v1/reports', url: '/api/v1/reports' },
        response: {
            status(code: number) {
                return {
                    json(body: Record<string, unknown>) {
                        sent.push({ status: code, body });
                    },
                };
            },
        },
    };
}

test('a new report is 201 and a duplicate is 200, both with the id', async () => {
    const controller = new ReportsController({
        async create(_userId: number, dto: CreateReportDto) {
            return dto.reason === 'OTHER'
                ? { id: 9, created: false }
                : { id: 4, created: true };
        },
    } as unknown as ReportsService);

    const user = { sub: '3', email: 'a@b.c', sessionId: '1' };
    const created = responseCapture();
    await controller.create(
        user,
        { messageId: 12, conversationId: 8, reason: 'HARMFUL', note: 'unsafe' },
        created.request as never,
        created.response as never,
    );
    const duplicate = responseCapture();
    await controller.create(
        user,
        { messageId: 12, conversationId: 8, reason: 'OTHER' },
        duplicate.request as never,
        duplicate.response as never,
    );

    assert.equal(created.sent[0]?.status, 201);
    assert.equal(created.sent[0]?.body.statusCode, 201);
    assert.equal(created.sent[0]?.body.success, true);
    assert.deepEqual(created.sent[0]?.body.data, { id: 4 });
    assert.equal(created.sent[0]?.body.path, '/api/v1/reports');

    assert.equal(duplicate.sent[0]?.status, 200);
    assert.equal(duplicate.sent[0]?.body.statusCode, 200);
    assert.deepEqual(duplicate.sent[0]?.body.data, { id: 9 });
});

test('the migration snapshots the report table and one report per person and message', () => {
    const migrations = join(fileURLToPath(new URL('.', import.meta.url)), '../../migrations/app');
    const dir = readdirSync(migrations).find((name) => name.endsWith('_add_message_reports'));
    assert.ok(dir);
    const ops = JSON.parse(readFileSync(join(migrations, dir, 'ops.json'), 'utf8')) as Array<{
        execute?: Array<{ sql?: string }>;
    }>;
    const sql = ops.flatMap((op) => op.execute ?? []).map((step) => step.sql ?? '').join('\n');
    assert.match(sql, /CREATE TABLE "public"\."messageReport"/);
    assert.match(sql, /UNIQUE \("userId", "messageId"\)/);
    assert.match(sql, /'HARMFUL', 'SEXUAL', 'HATE', 'INACCURATE', 'OTHER'/);
    assert.match(sql, /"content" text/);
    assert.match(sql, /'PENDING', 'REVIEWED', 'DISMISSED'/);
});
