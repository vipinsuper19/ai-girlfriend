import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { UsageFeatureDto } from './dto/record-usage.dto.js';
import { UsageService } from './usage.service.js';
import { UsageLimitExceededException } from './usage.exceptions.js';

function harness(plan = 'FREE') {
    const rows: Array<{
        id: number;
        userId: number;
        feature: string;
        quantity: number;
        createdAt: string;
    }> = [];

    const service = new UsageService(
        {
            client: {
                orm: {
                    public: {
                        UsageRecord: {
                            async create(row: {
                                userId: number;
                                feature: string;
                                quantity: number;
                            }) {
                                const saved = {
                                    id: rows.length + 1,
                                    createdAt: new Date().toISOString(),
                                    ...row,
                                };
                                rows.push(saved);
                                return saved;
                            },
                            where(filter: { userId: number; feature: string }) {
                                return {
                                    async all() {
                                        return rows.filter((row) =>
                                            row.userId === filter.userId
                                            && row.feature === filter.feature,
                                        );
                                    },
                                };
                            },
                        },
                    },
                },
            },
        } as never,
        {
            async getCurrent() {
                return { id: 7, plan };
            },
        } as never,
    );

    return { service, rows };
}

describe('usage service free-tier cap', { concurrency: false }, () => {
    test('blocks the next free reply after the daily message cap and resets at UTC midnight', async (t) => {
        delete process.env['FREE_TIER_LLM_PERIOD'];
        delete process.env['FREE_TIER_LLM_MESSAGE_LIMIT'];
        delete process.env['FREE_TIER_LLM_TOKEN_LIMIT'];
        t.mock.timers.enable({ apis: ['Date'] });
        t.mock.timers.setTime(Date.parse('2026-10-12T15:00:00.000Z'));

        const { service } = harness();
        for (let i = 0; i < 40; i += 1) {
            await service.charge(1, UsageFeatureDto.MESSAGES, 1);
        }

        await assert.rejects(
            () => service.check(1, UsageFeatureDto.MESSAGES, 1),
            (error: unknown) => {
                assert.ok(error instanceof UsageLimitExceededException);
                const body = error.getResponse() as {
                    code: string;
                    message: string;
                    period: string;
                    resetsAt: string;
                    remaining: number;
                    limit: number;
                };
                assert.equal(body.code, 'USAGE_LIMIT_EXCEEDED');
                assert.equal(body.message, 'Free tier daily limit reached for MESSAGES');
                assert.equal(body.period, 'day');
                assert.equal(body.resetsAt, '2026-10-13T00:00:00.000Z');
                assert.equal(body.remaining, 0);
                assert.equal(body.limit, 40);
                return true;
            },
        );

        t.mock.timers.setTime(Date.parse('2026-10-13T00:00:01.000Z'));
        const again = await service.check(1, UsageFeatureDto.MESSAGES, 1);
        assert.equal(again.allowed, true);
        assert.equal(again.used, 0);
        assert.equal(again.period, 'day');
    });

    test('a token cap is independent of the message count', async () => {
        process.env['FREE_TIER_LLM_TOKEN_LIMIT'] = '10';
        process.env['FREE_TIER_LLM_MESSAGE_LIMIT'] = '100';
        try {
            const { service } = harness();
            await service.charge(1, UsageFeatureDto.TEXT_TOKENS, 8);
            const allowed = await service.check(1, UsageFeatureDto.TEXT_TOKENS, 1);
            assert.equal(allowed.allowed, true);
            await assert.rejects(
                () => service.check(1, UsageFeatureDto.TEXT_TOKENS, 3),
                UsageLimitExceededException,
            );
        } finally {
            delete process.env['FREE_TIER_LLM_TOKEN_LIMIT'];
            delete process.env['FREE_TIER_LLM_MESSAGE_LIMIT'];
        }
    });

    test('premium messages stay unlimited on the calendar month', async (t) => {
        t.mock.timers.enable({ apis: ['Date'] });
        t.mock.timers.setTime(Date.parse('2026-10-12T15:00:00.000Z'));
        const { service } = harness('PREMIUM');
        const result = await service.check(3, UsageFeatureDto.MESSAGES, 1);
        assert.equal(result.limit, null);
        assert.equal(result.period, 'month');
        assert.equal(result.resetsAt, '2026-11-01T00:00:00.000Z');

        const summary = await service.getSummary(3);
        assert.equal(summary.period.start, '2026-10-01T00:00:00.000Z');
        assert.equal(summary.period.end, '2026-11-01T00:00:00.000Z');
    });

    test('charge records a reply that already succeeded without re-checking', async () => {
        const { service, rows } = harness();
        await service.charge(1, UsageFeatureDto.MESSAGES, 1, { conversationId: 5 });
        assert.equal(rows.length, 1);
        assert.equal(rows[0]?.quantity, 1);
    });
});
