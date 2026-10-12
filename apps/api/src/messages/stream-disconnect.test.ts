import 'reflect-metadata';
import http from 'node:http';
import assert from 'node:assert/strict';
import test from 'node:test';

import { Test } from '@nestjs/testing';

import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard.js';
import { acquireConversationLock } from './conversation-lock.js';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';

async function disconnectMidStream() {
    const created: Array<Record<string, unknown>> = [];
    const charges: string[] = [];
    let assistantPersisted = false;
    let sawAbort = false;
    let release: () => void = () => {};
    const settled = new Promise<void>((resolve) => {
        release = resolve;
    });

    const conversation = {
        where() {
            return {
                async first() {
                    return { id: 5, userId: 1, companionId: 3, deletedAt: null };
                },
                async update() {
                    return { id: 5 };
                },
            };
        },
    };
    const message = {
        async create(row: Record<string, unknown>) {
            const saved = { id: created.length + 1, ...row };
            created.push(saved);
            return saved;
        },
        where() {
            return {
                orderBy() { return this; },
                limit() { return this; },
                async first() { return null; },
                async all() { return []; },
                async update() { return null; },
            };
        },
    };

    const messagesService = new MessagesService(
        {
            client: { orm: { public: { Conversation: conversation, Message: message } } },
        } as never,
        {
            async *streamResponse(
                _userId: string,
                _conversationId: string,
                options?: { signal?: AbortSignal },
            ) {
                const signal = options?.signal;
                try {
                    yield { type: 'delta', content: 'Hel' };
                    await new Promise<void>((resolve) => {
                        if (signal?.aborted) {
                            resolve();
                            return;
                        }
                        const timer = setTimeout(resolve, 4_000);
                        signal?.addEventListener('abort', () => {
                            clearTimeout(timer);
                            resolve();
                        }, { once: true });
                    });
                    if (signal?.aborted) return;
                    assistantPersisted = true;
                    yield { type: 'done', message: { id: 9, content: 'Hello' } };
                } finally {
                    sawAbort = signal?.aborted === true;
                    release();
                }
            },
        } as never,
        { extractFromConversation() { return Promise.resolve(); } } as never,
        {
            async check() {
                return { allowed: true };
            },
            async charge(_userId: number, feature: string) {
                charges.push(feature);
            },
        } as never,
        { removeVoiceFile() { return Promise.resolve(); } } as never,
    );

    const moduleRef = await Test.createTestingModule({
        controllers: [MessagesController],
        providers: [
            { provide: MessagesService, useValue: messagesService },
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
        .overrideGuard(RateLimitGuard)
        .useValue({ canActivate: () => true })
        .compile();

    const app = moduleRef.createNestApplication();
    await app.listen(0, '127.0.0.1');

    try {
        const base = new URL(await app.getUrl());
        const body = JSON.stringify({ content: 'Hi' });
        let received = '';
        let statusCode = 0;

        await new Promise<void>((resolve, reject) => {
            const req = http.request(
                {
                    hostname: base.hostname,
                    port: base.port,
                    path: '/conversations/5/messages/stream',
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'content-length': Buffer.byteLength(body),
                    },
                },
                (res) => {
                    statusCode = res.statusCode ?? 0;
                    res.on('data', (chunk: Buffer) => {
                        received += chunk.toString('utf8');
                        if (received.includes('Hel')) req.destroy();
                    });
                    res.on('error', () => resolve());
                    res.on('close', () => resolve());
                },
            );
            req.on('error', () => {
                if (received.includes('Hel')) resolve();
                else reject(new Error(`connection failed before the delta: ${received}`));
            });
            req.write(body);
            req.end();
        });

        if (!received.includes('Hel')) {
            throw new Error(`stream ended before the delta (${statusCode}): ${received}`);
        }

        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            await Promise.race([
                settled,
                new Promise((_, reject) => {
                    timer = setTimeout(() => reject(new Error('server did not settle after disconnect')), 7_000);
                }),
            ]);
        } finally {
            clearTimeout(timer);
        }

        return {
            received,
            sawAbort,
            assistantPersisted,
            created,
            charges,
            close: () => app.close(),
        };
    } catch (error) {
        release();
        await app.close();
        throw error;
    }
}

test('a client disconnect mid-stream aborts and does not persist or charge', async () => {
    const result = await disconnectMidStream();
    try {
        assert.match(result.received, /Hel/);
        assert.equal(result.sawAbort, true);
        assert.equal(result.assistantPersisted, false);
        assert.equal(result.created.some((row) => row['role'] === 'ASSISTANT'), false);
        assert.deepEqual(result.charges, []);
    } finally {
        await result.close();
    }
});

test('the conversation lock is released when the client disconnects mid-stream', async () => {
    const result = await disconnectMidStream();
    try {
        let lockReleased = false;
        const next = acquireConversationLock(5).then((releaseNext) => {
            lockReleased = true;
            releaseNext();
        });
        await Promise.race([
            next,
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error('conversation lock was still held after disconnect')), 1_000);
            }),
        ]);
        assert.equal(lockReleased, true);
    } finally {
        await result.close();
    }
});
