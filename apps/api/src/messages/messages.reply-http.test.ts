import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';

import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import { AgeConfirmedGuard } from '../auth/age-confirmed.guard.js';
import { API_BASE_PATH } from '../common/constants/api.constants.js';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard.js';
import { RateLimitService } from '../rate-limit/rate-limit.service.js';
import { UsageLimitExceededException } from '../usage/usage.exceptions.js';
import { NotLatestUserMessageException } from './messages.exceptions.js';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';

const KEY = '3f1c2a4e-7b90-4d1e-8c33-1a2b3c4d5e6f';

function eventsOf(body: string) {
    return body
        .split('\n\n')
        .map((block) => block.trim())
        .filter((block) => block.startsWith('event:'))
        .map((block) => {
            const [eventLine, dataLine] = block.split('\n');
            return {
                event: eventLine.slice('event: '.length),
                data: JSON.parse(dataLine.slice('data: '.length)) as {
                    type: string;
                    message?: { id?: number; content?: string };
                },
            };
        });
}

async function listen(service: object, options: { rateLimit?: boolean } = {}) {
    const builder = Test.createTestingModule({
        controllers: [MessagesController],
        providers: [
            { provide: MessagesService, useValue: service as MessagesService },
        ],
    })
        .overrideGuard(JwtAuthGuard)
        .useValue({
            canActivate(context: { switchToHttp(): { getRequest(): { user?: unknown } } }) {
                context.switchToHttp().getRequest().user = {
                    sub: '1',
                    email: 'a@b.co',
                    sessionId: '1',
                };
                return true;
            },
        })
        .overrideGuard(AgeConfirmedGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(RateLimitGuard)
        .useValue(options.rateLimit
            ? new RateLimitGuard(new Reflector(), new RateLimitService())
            : { canActivate: () => true });

    const moduleRef = await builder.compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_BASE_PATH);
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');
    return app;
}

test('POST reply/stream with an empty body emits done for an existing reply', async () => {
    const app = await listen({
        async prepareReplyStream() {
            return undefined;
        },
        async *streamReply() {
            yield { type: 'done', message: { id: 9, role: 'ASSISTANT', content: 'Already here' } };
        },
    });

    try {
        const response = await fetch(
            `${await app.getUrl()}/${API_BASE_PATH}/conversations/5/messages/8/reply/stream`,
            { method: 'POST' },
        );
        assert.equal(response.status, 201);
        assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
        assert.match(response.headers.get('cache-control') ?? '', /^no-cache\b/);
        const events = eventsOf(await response.text());
        assert.equal(events.length, 1);
        assert.equal(events[0]?.event, 'done');
        assert.equal(events[0]?.data.type, 'done');
        assert.equal(events[0]?.data.message?.id, 9);
    } finally {
        await app.close();
    }
});

test('reply stream errors keep their status and code', async () => {
    const app = await listen({
        async prepareReplyStream(_userId: string, _conversationId: string, userMessageId: string) {
            if (userMessageId === '99') throw new NotFoundException('Message not found');
            if (userMessageId === '7') throw new NotLatestUserMessageException();
            throw new UsageLimitExceededException('MESSAGES', 40, 40, 1, {
                period: 'day',
                resetsAt: '2026-10-13T00:00:00.000Z',
            });
        },
        async *streamReply() {
            yield { type: 'done', message: { id: 0 } };
            throw new Error('stream should not start');
        },
    });

    try {
        const base = `${await app.getUrl()}/${API_BASE_PATH}`;
        const missing = await fetch(`${base}/conversations/5/messages/99/reply/stream`, { method: 'POST' });
        assert.equal(missing.status, 404);
        const missingBody = await missing.json() as { code?: string; message: string };
        assert.equal(missingBody.message, 'Message not found');

        const stale = await fetch(`${base}/conversations/5/messages/7/reply/stream`, { method: 'POST' });
        assert.equal(stale.status, 409);
        const staleBody = await stale.json() as { code?: string };
        assert.equal(staleBody.code, 'NOT_LATEST_USER_MESSAGE');

        const capped = await fetch(`${base}/conversations/5/messages/8/reply/stream`, { method: 'POST' });
        assert.equal(capped.status, 403);
        const cappedBody = await capped.json() as { code?: string };
        assert.equal(cappedBody.code, 'USAGE_LIMIT_EXCEEDED');
    } finally {
        await app.close();
    }
});

test('a limited reply stream is 429 with Retry-After', async () => {
    const previous = {
        ip: process.env['RATE_LIMIT_MESSAGES_IP_MAX'],
        user: process.env['RATE_LIMIT_MESSAGES_USER_MAX'],
    };
    process.env['RATE_LIMIT_MESSAGES_IP_MAX'] = '1';
    process.env['RATE_LIMIT_MESSAGES_USER_MAX'] = '1';
    const app = await listen({
        async prepareReplyStream() {
            return undefined;
        },
        async *streamReply() {
            yield { type: 'done', message: { id: 9, content: 'ok' } };
        },
    }, { rateLimit: true });

    try {
        const url = `${await app.getUrl()}/${API_BASE_PATH}/conversations/5/messages/8/reply/stream`;
        const first = await fetch(url, { method: 'POST' });
        assert.equal(first.status, 201);
        await first.text();
        const second = await fetch(url, { method: 'POST' });
        assert.equal(second.status, 429);
        assert.ok(Number(second.headers.get('retry-after')) >= 1);
        const body = await second.json() as { code?: string; retryAfterSeconds?: number };
        assert.equal(body.code, 'RATE_LIMITED');
        assert.ok((body.retryAfterSeconds ?? 0) >= 1);
    } finally {
        if (previous.ip == null) delete process.env['RATE_LIMIT_MESSAGES_IP_MAX'];
        else process.env['RATE_LIMIT_MESSAGES_IP_MAX'] = previous.ip;
        if (previous.user == null) delete process.env['RATE_LIMIT_MESSAGES_USER_MAX'];
        else process.env['RATE_LIMIT_MESSAGES_USER_MAX'] = previous.user;
        await app.close();
    }
});

test('Idempotency-Key on a non-stream send is forwarded', async () => {
    let seen: string | string[] | undefined;
    const app = await listen({
        async create(
            _userId: string,
            _conversationId: string,
            _dto: { content: string },
            key?: string | string[] | null,
        ) {
            seen = key ?? undefined;
            return { userMessage: { id: 8 }, assistantMessage: { id: 9 } };
        },
    });

    try {
        const response = await fetch(
            `${await app.getUrl()}/${API_BASE_PATH}/conversations/5/messages`,
            {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'idempotency-key': KEY,
                },
                body: JSON.stringify({ content: 'Hi' }),
            },
        );
        assert.equal(response.status, 201);
        assert.equal(seen, KEY);
    } finally {
        await app.close();
    }
});

test('Idempotency-Key on the send stream is forwarded and a replay is done without a new post', async () => {
    const seen: Array<string | undefined> = [];
    const app = await listen({
        async prepareSend(_userId: string, _conversationId: string, key?: string | null) {
            seen.push(key ?? undefined);
        },
        async *createAndStream(
            _userId: string,
            _conversationId: string,
            _dto: { content: string },
            _signal?: AbortSignal,
            key?: string | null,
        ) {
            seen.push(key ?? undefined);
            yield { type: 'message', message: { id: 8, role: 'USER', content: 'Hi' } };
            yield { type: 'done', message: { id: 9, role: 'ASSISTANT', content: 'Hello' } };
        },
    });

    try {
        const response = await fetch(
            `${await app.getUrl()}/${API_BASE_PATH}/conversations/5/messages/stream`,
            {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'idempotency-key': KEY,
                },
                body: JSON.stringify({ content: 'Hi' }),
            },
        );
        assert.equal(response.status, 201);
        const events = eventsOf(await response.text());
        assert.deepEqual(events.map((event) => event.event), ['message', 'done']);
        assert.deepEqual(seen, [KEY, KEY]);
    } finally {
        await app.close();
    }
});
