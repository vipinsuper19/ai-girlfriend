import assert from 'node:assert/strict';
import test from 'node:test';

import { UsageFeatureDto } from '../usage/dto/record-usage.dto.js';
import { estimateTokens } from '../usage/estimate-tokens.js';
import { UsageLimitExceededException } from '../usage/usage.exceptions.js';
import { MessagesService } from './messages.service.js';

function serviceFor(options: {
    planCheck?: () => Promise<unknown>;
    generate?: () => Promise<unknown>;
    stream?: (userId: string, conversationId: string, options?: { signal?: AbortSignal }) => AsyncGenerator<unknown>;
}) {
    const conversations = [{
        id: 5,
        userId: 1,
        companionId: 3,
        deletedAt: null as string | null,
    }];
    const messages: Array<Record<string, unknown>> = [
        { id: 8, conversationId: 5, role: 'USER', content: 'earlier', deletedAt: null },
        { id: 9, conversationId: 5, role: 'ASSISTANT', content: 'old', deletedAt: null },
    ];
    let nextId = 10;
    const charges: Array<{ feature: string; quantity: number }> = [];
    let generated = 0;

    const conversationApi = {
        where(filter: { id?: number; userId?: number; deletedAt?: null }) {
            const rows = conversations.filter((row) => {
                if (filter.id != null && row.id !== filter.id) return false;
                if (filter.userId != null && row.userId !== filter.userId) return false;
                if ('deletedAt' in filter && filter.deletedAt === null && row.deletedAt !== null) {
                    return false;
                }
                return true;
            });
            return {
                async first() {
                    return rows[0] ?? null;
                },
                async update(patch: Record<string, unknown>) {
                    for (const row of rows) Object.assign(row, patch);
                    return rows[0];
                },
            };
        },
    };

    const messageApi = {
        async create(row: Record<string, unknown>) {
            const saved = { id: nextId++, deletedAt: null, ...row };
            messages.push(saved);
            return saved;
        },
        where(filter: { id?: number; conversationId?: number; deletedAt?: null }) {
            let rows = messages.filter((row) => {
                if (filter.id != null && row.id !== filter.id) return false;
                if (filter.conversationId != null && row.conversationId !== filter.conversationId) {
                    return false;
                }
                if ('deletedAt' in filter && filter.deletedAt === null && row.deletedAt !== null) {
                    return false;
                }
                return true;
            });
            const api = {
                orderBy() {
                    return api;
                },
                limit(count: number) {
                    rows = [...rows].sort((a, b) => Number(b['id']) - Number(a['id'])).slice(0, count);
                    return api;
                },
                async first() {
                    return rows[0] ?? null;
                },
                async all() {
                    return rows;
                },
                async update(patch: Record<string, unknown>) {
                    const targets = messages.filter((row) => filter.id == null || row['id'] === filter.id);
                    for (const row of targets) Object.assign(row, patch);
                    return targets[0];
                },
            };
            return api;
        },
    };

    const usage = {
        async check() {
            if (options.planCheck) return options.planCheck();
            return { allowed: true };
        },
        async charge(_userId: number, feature: string, quantity: number) {
            charges.push({ feature, quantity });
        },
        async consume() {
            throw new Error('chat must not consume usage up front');
        },
    };

    const ai = {
        async generateResponse() {
            generated += 1;
            if (options.generate) return options.generate();
            return { id: 11, content: 'Hello' };
        },
        streamResponse: options.stream ?? (async function* () {
            yield { type: 'done', message: { id: 12, content: 'Hello' } };
        }),
    };

    const messagesService = new MessagesService(
        { client: { orm: { public: { Conversation: conversationApi, Message: messageApi } } } } as never,
        ai as never,
        { extractFromConversation() { return Promise.resolve(); } } as never,
        usage as never,
        { removeVoiceFile() { return Promise.resolve(); } } as never,
    );

    return { messagesService, charges, messages, generated: () => generated };
}

test('a successful reply is charged after the model returns', async () => {
    const order: string[] = [];
    const { messagesService, charges } = serviceFor({
        planCheck: async () => {
            order.push('check');
            return { allowed: true };
        },
        generate: async () => {
            order.push('generate');
            return { id: 11, content: 'Hello' };
        },
    });
    const created = await messagesService.create('1', '5', { content: 'Hi' });
    order.push('done');

    assert.deepEqual(order, ['check', 'check', 'generate', 'done']);
    assert.deepEqual(charges, [
        { feature: UsageFeatureDto.MESSAGES, quantity: 1 },
        {
            feature: UsageFeatureDto.TEXT_TOKENS,
            quantity: estimateTokens('Hi') + estimateTokens('Hello'),
        },
    ]);
    assert.equal(created.assistantMessage.content, 'Hello');
});

test('a failed reply is not charged and the model is not called once the cap is hit', async () => {
    const { messagesService, charges, generated } = serviceFor({
        planCheck: async () => {
            throw new UsageLimitExceededException('MESSAGES', 40, 40, 1, {
                period: 'day',
                resetsAt: '2026-10-13T00:00:00.000Z',
            });
        },
    });

    await assert.rejects(
        () => messagesService.create('1', '5', { content: 'Hi' }),
        UsageLimitExceededException,
    );
    assert.equal(generated(), 0);
    assert.deepEqual(charges, []);
});

test('a provider failure after the user line is saved is not charged', async () => {
    const { messagesService, charges, generated } = serviceFor({
        generate: async () => {
            throw new Error('provider down');
        },
    });

    await assert.rejects(
        () => messagesService.create('1', '5', { content: 'Hi' }),
        /provider down/,
    );
    assert.equal(generated(), 1);
    assert.deepEqual(charges, []);
});

test('regenerate restores her previous reply when generation fails and does not charge', async () => {
    const { messagesService, charges, messages } = serviceFor({
        generate: async () => {
            throw new Error('provider down');
        },
    });

    await assert.rejects(
        () => messagesService.regenerate('1', '9'),
        /provider down/,
    );
    const previous = messages.find((row) => row['id'] === 9);
    assert.equal(previous?.['deletedAt'], null);
    assert.deepEqual(charges, []);
});

test('a stream charges only when the reply completes', async () => {
    const { messagesService, charges } = serviceFor({
        stream: async function* () {
            yield { type: 'delta', content: 'Hel' };
            yield { type: 'done', message: { id: 12, content: 'Hello' } };
        },
    });

    const events = [];
    for await (const event of messagesService.createAndStream('1', '5', { content: 'Hi' })) {
        events.push(event.type);
    }

    assert.deepEqual(events, ['message', 'delta', 'done']);
    assert.equal(charges.length, 2);
});

test('an aborted stream does not charge', async () => {
    const controller = new AbortController();
    let sawSignal = false;
    const { messagesService, charges } = serviceFor({
        stream: async function* (_userId, _conversationId, options) {
            sawSignal = options?.signal === controller.signal;
            yield { type: 'delta', content: 'Hel' };
            if (options?.signal?.aborted) return;
        },
    });
    controller.abort();

    const events = [];
    for await (const event of messagesService.createAndStream(
        '1',
        '5',
        { content: 'Hi' },
        controller.signal,
    )) {
        events.push(event.type);
    }

    assert.equal(sawSignal, true);
    assert.deepEqual(events, ['message']);
    assert.deepEqual(charges, []);
});
