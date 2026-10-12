import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException, NotFoundException } from '@nestjs/common';

import { REFUSAL_MESSAGE } from '../moderation/safety-policy.js';
import { UsageFeatureDto } from '../usage/dto/record-usage.dto.js';
import { UsageLimitExceededException } from '../usage/usage.exceptions.js';
import { IdempotencyKeyReusedException, NotLatestUserMessageException } from './messages.exceptions.js';
import { MessagesService } from './messages.service.js';

const KEY = '3f1c2a4e-7b90-4d1e-8c33-1a2b3c4d5e6f';

type Row = Record<string, unknown> & { id: number };

function matches(row: Row, filter: Record<string, unknown>) {
    for (const [key, value] of Object.entries(filter)) {
        if (key === 'deletedAt' && value === null) {
            if (row.deletedAt != null) return false;
            continue;
        }
        if (row[key] !== value) return false;
    }
    return true;
}

function columnProxy(
    checks: Array<(row: Row) => boolean>,
    dir: { value: 'asc' | 'desc' | null },
) {
    return new Proxy({}, {
        get(_target, prop) {
            const name = String(prop);
            return {
                gt(value: number) {
                    checks.push((row) => Number(row[name]) > Number(value));
                },
                lt(value: number) {
                    checks.push((row) => Number(row[name]) < Number(value));
                },
                asc() {
                    dir.value = 'asc';
                },
                desc() {
                    dir.value = 'desc';
                },
            };
        },
    });
}

function messageQuery(
    rows: Row[],
    filters: Array<(row: Row) => boolean>,
    dir: 'asc' | 'desc',
    limited: number | null,
) {
    const apply = () => {
        let out = rows.filter((row) => filters.every((filter) => filter(row)));
        out = [...out].sort((a, b) => dir === 'asc' ? a.id - b.id : b.id - a.id);
        if (limited != null) out = out.slice(0, limited);
        return out;
    };
    const api = {
        where(filter: unknown) {
            if (typeof filter === 'function') {
                const checks: Array<(row: Row) => boolean> = [];
                const orderDir = { value: null as 'asc' | 'desc' | null };
                filter(columnProxy(checks, orderDir));
                return messageQuery(
                    rows,
                    [...filters, (row) => checks.every((check) => check(row))],
                    dir,
                    limited,
                );
            }
            return messageQuery(
                rows,
                [...filters, (row) => matches(row, filter as Record<string, unknown>)],
                dir,
                limited,
            );
        },
        orderBy(fn: (message: unknown) => unknown) {
            const orderDir = { value: 'asc' as 'asc' | 'desc' | null };
            fn(columnProxy([], orderDir));
            return messageQuery(rows, filters, orderDir.value ?? 'asc', limited);
        },
        limit(count: number) {
            return messageQuery(rows, filters, dir, count);
        },
        async first() {
            return apply()[0] ?? null;
        },
        async all() {
            return apply();
        },
        async update(patch: Record<string, unknown>) {
            const targets = apply();
            for (const row of targets) Object.assign(row, patch);
            return targets[0] ?? null;
        },
    };
    return api;
}

function harness(options: {
    messages?: Row[];
    planCheck?: () => Promise<unknown>;
    stream?: (
        userId: string,
        conversationId: string,
        options?: { signal?: AbortSignal },
    ) => AsyncGenerator<unknown>;
    persistAssistant?: boolean;
} = {}) {
    const conversations = [{
        id: 5,
        userId: 1,
        companionId: 3,
        deletedAt: null as string | null,
    }, {
        id: 6,
        userId: 1,
        companionId: 3,
        deletedAt: null as string | null,
    }];
    const messages: Row[] = options.messages ?? [{
        id: 8,
        conversationId: 5,
        userId: 1,
        role: 'USER',
        content: 'Hi',
        deletedAt: null,
        createdAt: new Date().toISOString(),
    }];
    let nextId = Math.max(0, ...messages.map((row) => row.id)) + 1;
    const charges: Array<{ feature: string; quantity: number }> = [];
    let generated = 0;

    function persistAssistant(conversationId: number, content: string) {
        const saved: Row = {
            id: nextId++,
            conversationId,
            role: 'ASSISTANT',
            content,
            metadata: null,
            deletedAt: null,
            createdAt: new Date().toISOString(),
        };
        messages.push(saved);
        return saved;
    }

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
                    return rows[0] ?? null;
                },
            };
        },
    };

    const messageApi = {
        async create(data: Record<string, unknown>) {
            if (data.idempotencyKey != null && data.userId != null) {
                const clash = messages.find((row) =>
                    row.userId === data.userId && row.idempotencyKey === data.idempotencyKey,
                );
                if (clash) {
                    const error = new Error(
                        'duplicate key value violates unique constraint "message_userId_idempotencyKey_key"',
                    ) as Error & { code: string };
                    error.code = '23505';
                    throw error;
                }
            }
            const saved: Row = {
                id: nextId++,
                deletedAt: null,
                createdAt: new Date().toISOString(),
                ...data,
            };
            messages.push(saved);
            return saved;
        },
        where(filter: unknown) {
            return messageQuery(messages, [], 'asc', null).where(filter);
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
    };

    const ai = {
        async generateResponse(_userId: string | number, conversationId: string | number) {
            generated += 1;
            if (options.persistAssistant === false) {
                return { id: nextId++, content: 'Hello', metadata: null };
            }
            return persistAssistant(Number(conversationId), 'Hello');
        },
        streamResponse: options.stream ?? (async function* (
            _userId: string,
            conversationId: string,
        ) {
            generated += 1;
            const saved = options.persistAssistant === false
                ? { id: nextId++, content: 'Hello', metadata: null }
                : persistAssistant(Number(conversationId), 'Hello');
            yield { type: 'delta', content: 'Hello' };
            yield { type: 'done', message: saved };
        }),
    };

    const messagesService = new MessagesService(
        { client: { orm: { public: { Conversation: conversationApi, Message: messageApi } } } } as never,
        ai as never,
        { extractFromConversation() { return Promise.resolve(); } } as never,
        usage as never,
        { removeVoiceFile() { return Promise.resolve(); } } as never,
    );

    return {
        messagesService,
        messages,
        charges,
        generated: () => generated,
    };
}

async function collect(
    events: AsyncIterable<{ type: string; message?: { id?: number }; safety?: { code?: string } } | object>,
) {
    const out: Array<{ type: string; message?: { id?: number }; safety?: { code?: string } }> = [];
    for await (const event of events as AsyncIterable<{
        type: string;
        message?: { id?: number };
        safety?: { code?: string };
    }>) {
        out.push(event);
    }
    return out;
}

test('an existing assistant reply is returned and nothing is charged', async () => {
    const { messagesService, charges, generated } = harness({
        messages: [
            {
                id: 8,
                conversationId: 5,
                role: 'USER',
                content: 'Hi',
                deletedAt: null,
                createdAt: new Date().toISOString(),
            },
            {
                id: 9,
                conversationId: 5,
                role: 'ASSISTANT',
                content: 'Already here',
                deletedAt: null,
                createdAt: new Date().toISOString(),
            },
        ],
        planCheck: async () => {
            throw new UsageLimitExceededException('MESSAGES', 40, 40, 1);
        },
    });

    await messagesService.prepareReplyStream('1', '5', '8');
    const events = await collect(messagesService.streamReply('1', '5', '8'));
    assert.deepEqual(events.map((event) => event.type), ['done']);
    assert.equal(events[0]?.message?.id, 9);
    assert.equal(generated(), 0);
    assert.deepEqual(charges, []);
});

test('a second reply stream does not generate again', async () => {
    const { messagesService, charges, generated } = harness();
    const first = await collect(messagesService.streamReply('1', '5', '8'));
    const second = await collect(messagesService.streamReply('1', '5', '8'));

    assert.equal(first.at(-1)?.type, 'done');
    assert.deepEqual(second.map((event) => event.type), ['done']);
    assert.equal(second[0]?.message?.id, first.at(-1)?.message?.id);
    assert.equal(generated(), 1);
    assert.equal(charges.filter((charge) => charge.feature === UsageFeatureDto.MESSAGES).length, 1);
});

test('concurrent reply streams generate one assistant message', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    let started = 0;
    const { messagesService, messages } = harness({
        stream: async function* (_userId, conversationId) {
            started += 1;
            if (started === 1) await gate;
            const saved = {
                id: 20 + started,
                conversationId: Number(conversationId),
                role: 'ASSISTANT',
                content: 'Hello',
                deletedAt: null,
                createdAt: new Date().toISOString(),
            };
            messages.push(saved);
            yield { type: 'done', message: saved };
        },
    });

    const first = collect(messagesService.streamReply('1', '5', '8'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = collect(messagesService.streamReply('1', '5', '8'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(started, 1);
    release();
    const [firstEvents, secondEvents] = await Promise.all([first, second]);
    assert.equal(firstEvents.at(-1)?.type, 'done');
    assert.equal(secondEvents.at(-1)?.type, 'done');
    assert.equal(started, 1);
    assert.equal(messages.filter((row) => row.role === 'ASSISTANT').length, 1);
});

test('retrying over the free-tier cap is rejected before generation', async () => {
    const { messagesService, charges, generated } = harness({
        planCheck: async () => {
            throw new UsageLimitExceededException('MESSAGES', 40, 40, 1, {
                period: 'day',
                resetsAt: '2026-10-13T00:00:00.000Z',
            });
        },
    });

    await assert.rejects(
        () => messagesService.prepareReplyStream('1', '5', '8'),
        (error: unknown) => {
            assert.ok(error instanceof UsageLimitExceededException);
            assert.equal(error.getStatus(), 403);
            const body = error.getResponse() as { code?: string };
            assert.equal(body.code, 'USAGE_LIMIT_EXCEEDED');
            return true;
        },
    );
    assert.equal(generated(), 0);
    assert.deepEqual(charges, []);
});

test('a moderated retry is not charged', async () => {
    const refused = {
        id: 12,
        role: 'ASSISTANT',
        content: REFUSAL_MESSAGE,
        metadata: {
            safety: {
                action: 'refuse',
                code: 'content_policy',
                message: REFUSAL_MESSAGE,
            },
        },
    };
    const { messagesService, charges, messages } = harness({
        persistAssistant: false,
        stream: async function* () {
            messages.push({
                ...refused,
                conversationId: 5,
                deletedAt: null,
                createdAt: new Date().toISOString(),
            });
            yield { type: 'delta', content: REFUSAL_MESSAGE };
            yield {
                type: 'done',
                message: refused,
                safety: refused.metadata.safety,
            };
        },
    });

    const events = await collect(messagesService.streamReply('1', '5', '8'));
    assert.equal(events.at(-1)?.type, 'done');
    assert.equal(events.at(-1)?.safety?.code, 'content_policy');
    assert.deepEqual(charges, []);
});

test('reply errors are 404 when missing or unowned and 409 when it is not the latest user line', async () => {
    const { messagesService } = harness({
        messages: [
            {
                id: 8,
                conversationId: 5,
                role: 'USER',
                content: 'Hi',
                deletedAt: null,
                createdAt: new Date().toISOString(),
            },
            {
                id: 9,
                conversationId: 5,
                role: 'USER',
                content: 'Later',
                deletedAt: null,
                createdAt: new Date().toISOString(),
            },
            {
                id: 10,
                conversationId: 5,
                role: 'ASSISTANT',
                content: 'Her line',
                deletedAt: null,
                createdAt: new Date().toISOString(),
            },
        ],
    });

    await assert.rejects(
        () => messagesService.prepareReplyStream('1', '5', '99'),
        NotFoundException,
    );
    await assert.rejects(
        () => messagesService.prepareReplyStream('2', '5', '8'),
        NotFoundException,
    );
    await assert.rejects(
        () => messagesService.prepareReplyStream('1', '5', '10'),
        NotFoundException,
    );
    await assert.rejects(
        () => messagesService.prepareReplyStream('1', '5', '8'),
        (error: unknown) => {
            assert.ok(error instanceof NotLatestUserMessageException);
            assert.equal(error.getStatus(), 409);
            const body = error.getResponse() as { code?: string };
            assert.equal(body.code, 'NOT_LATEST_USER_MESSAGE');
            return true;
        },
    );
});

test('an aborted reply stream does not charge', async () => {
    const controller = new AbortController();
    const { messagesService, charges } = harness({
        stream: async function* (_userId, _conversationId, options) {
            yield { type: 'delta', content: 'Hel' };
            if (options?.signal?.aborted) return;
            yield { type: 'done', message: { id: 12, content: 'Hello' } };
        },
    });
    controller.abort();
    const events = await collect(messagesService.streamReply('1', '5', '8', controller.signal));
    assert.deepEqual(events.map((event) => event.type), []);
    assert.deepEqual(charges, []);
});

test('the same Idempotency-Key returns the original send', async () => {
    const { messagesService, messages, charges, generated } = harness({ messages: [] });
    const first = await messagesService.create('1', '5', { content: 'Hi' }, KEY);
    const second = await messagesService.create('1', '5', { content: 'Hi again' }, KEY);

    assert.equal(second.userMessage.id, first.userMessage.id);
    assert.equal(second.assistantMessage.id, first.assistantMessage.id);
    assert.equal(second.userMessage.content, 'Hi');
    assert.equal(messages.filter((row) => row.role === 'USER').length, 1);
    assert.equal(generated(), 1);
    assert.equal(charges.filter((charge) => charge.feature === UsageFeatureDto.MESSAGES).length, 1);
});

test('a resend continues an unanswered user line instead of inserting another', async () => {
    const { messagesService, messages, generated } = harness({
        messages: [{
            id: 8,
            conversationId: 5,
            userId: 1,
            idempotencyKey: KEY,
            role: 'USER',
            content: 'Hi',
            deletedAt: null,
            createdAt: new Date().toISOString(),
        }],
    });

    const continued = await messagesService.create('1', '5', { content: 'Hi' }, KEY);
    assert.equal(continued.userMessage.id, 8);
    assert.equal(continued.assistantMessage.role, 'ASSISTANT');
    assert.equal(messages.filter((row) => row.role === 'USER').length, 1);
    assert.equal(generated(), 1);
});

test('a streamed resend replays the original message and reply', async () => {
    const { messagesService, generated } = harness({ messages: [] });
    const first = await collect(
        messagesService.createAndStream('1', '5', { content: 'Hi' }, undefined, KEY),
    );
    const second = await collect(
        messagesService.createAndStream('1', '5', { content: 'Hi' }, undefined, KEY),
    );

    assert.deepEqual(first.map((event) => event.type), ['message', 'delta', 'done']);
    assert.deepEqual(second.map((event) => event.type), ['message', 'done']);
    assert.equal(second[0]?.message?.id, first[0]?.message?.id);
    assert.equal(second.at(-1)?.message?.id, first.at(-1)?.message?.id);
    assert.equal(generated(), 1);
});

test('two sends with the same key generate one reply', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    let started = 0;
    const { messagesService, messages } = harness({
        messages: [],
        stream: async function* (_userId, conversationId) {
            started += 1;
            if (started === 1) await gate;
            const saved: Row = {
                id: 40 + started,
                conversationId: Number(conversationId),
                role: 'ASSISTANT',
                content: 'Hello',
                deletedAt: null,
                createdAt: new Date().toISOString(),
            };
            messages.push(saved);
            yield { type: 'done', message: saved };
        },
    });

    const first = collect(
        messagesService.createAndStream('1', '5', { content: 'Hi' }, undefined, KEY),
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    const second = collect(
        messagesService.createAndStream('1', '5', { content: 'Hi' }, undefined, KEY),
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(started, 1);
    release();
    const [a, b] = await Promise.all([first, second]);
    assert.equal(a[0]?.message?.id, b[0]?.message?.id);
    assert.equal(b.at(-1)?.type, 'done');
    assert.equal(messages.filter((row) => row.idempotencyKey === KEY).length, 1);
    assert.equal(messages.filter((row) => row.role === 'ASSISTANT').length, 1);
});

test('an idempotency key expires after 24 hours', async () => {
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const { messagesService, messages, generated } = harness({
        messages: [{
            id: 8,
            conversationId: 5,
            userId: 1,
            idempotencyKey: KEY,
            role: 'USER',
            content: 'Old',
            deletedAt: null,
            createdAt: stale,
        }],
    });

    const created = await messagesService.create('1', '5', { content: 'New' }, KEY);
    assert.notEqual(created.userMessage.id, 8);
    assert.equal(created.userMessage.content, 'New');
    assert.equal(messages.find((row) => row.id === 8)?.idempotencyKey, null);
    assert.equal(generated(), 1);
});

test('the same key cannot be reused on another conversation', async () => {
    const { messagesService } = harness({
        messages: [{
            id: 8,
            conversationId: 5,
            userId: 1,
            idempotencyKey: KEY,
            role: 'USER',
            content: 'Hi',
            deletedAt: null,
            createdAt: new Date().toISOString(),
        }, {
            id: 9,
            conversationId: 5,
            role: 'ASSISTANT',
            content: 'Hello',
            deletedAt: null,
            createdAt: new Date().toISOString(),
        }],
    });

    await assert.rejects(
        () => messagesService.create('1', '6', { content: 'Hi' }, KEY),
        (error: unknown) => {
            assert.ok(error instanceof IdempotencyKeyReusedException);
            const body = error.getResponse() as { code?: string };
            assert.equal(body.code, 'IDEMPOTENCY_KEY_REUSED');
            return true;
        },
    );
});

test('a non-UUID Idempotency-Key is rejected', async () => {
    const { messagesService, generated } = harness({ messages: [] });
    await assert.rejects(
        () => messagesService.create('1', '5', { content: 'Hi' }, 'nope'),
        (error: unknown) => error instanceof BadRequestException,
    );
    assert.equal(generated(), 0);
});
