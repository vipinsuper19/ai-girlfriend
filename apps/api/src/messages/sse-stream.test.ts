import assert from 'node:assert/strict';
import test from 'node:test';

import {
    formatSseEvent,
    SSE_KEEPALIVE,
    streamErrorPayload,
    writeServerSentEvents,
} from './sse-stream.js';
import { GenerationTemporarilyUnavailableException } from '../ai/generation-unavailable.js';
import { UsageLimitExceededException } from '../usage/usage.exceptions.js';

test('formats an event the client can split on a blank line', () => {
    assert.equal(
        formatSseEvent('delta', { type: 'delta', content: 'Hi' }),
        'event: delta\ndata: {"type":"delta","content":"Hi"}\n\n',
    );
});

test('writes a ping comment while the next event is still pending', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
    const chunks: string[] = [];

    async function* events() {
        yield { type: 'message', content: 'hello' };
        await new Promise((resolve) => setTimeout(resolve, 45_000));
        yield { type: 'delta', content: 'there' };
    }

    const done = writeServerSentEvents(events(), (chunk) => {
        chunks.push(chunk);
    }, 20_000);

    await new Promise((resolve) => setImmediate(resolve));
    assert.match(chunks[0] ?? '', /event: message/);

    t.mock.timers.tick(20_000);
    assert.ok(chunks.includes(SSE_KEEPALIVE));

    t.mock.timers.tick(25_000);
    await done;

    assert.ok(chunks.some((chunk) => chunk.startsWith('event: delta')));
});

test('a stream error keeps the usage limit code', () => {
    const error = new UsageLimitExceededException('MESSAGES', 100, 100, 1);
    assert.deepEqual(streamErrorPayload(error), {
        message: 'Usage limit exceeded for MESSAGES',
        code: 'USAGE_LIMIT_EXCEEDED',
        feature: 'MESSAGES',
        limit: 100,
        used: 100,
        requested: 1,
        remaining: 0,
    });
});

test('a daily cap error includes when it resets', () => {
    const error = new UsageLimitExceededException('MESSAGES', 40, 40, 1, {
        period: 'day',
        resetsAt: '2026-10-13T00:00:00.000Z',
    });
    assert.equal(streamErrorPayload(error).message, 'Free tier daily limit reached for MESSAGES');
    assert.equal(streamErrorPayload(error).resetsAt, '2026-10-13T00:00:00.000Z');
    assert.equal(streamErrorPayload(error).period, 'day');
});

test('a failed write stops the generator', async () => {
    let continued = false;
    async function* events() {
        yield { type: 'delta', content: 'a' };
        continued = true;
        yield { type: 'delta', content: 'b' };
    }

    await assert.rejects(
        writeServerSentEvents(events(), () => {
            throw new Error('closed');
        }),
    );
    assert.equal(continued, false);
});

test('a failed write asks the caller to stop', async () => {
    let stopped = false;

    async function* events() {
        yield { type: 'delta', content: 'a' };
        yield { type: 'delta', content: 'b' };
    }

    await assert.rejects(
        writeServerSentEvents(
            events(),
            () => {
                throw new Error('closed');
            },
            60_000,
            undefined,
            () => {
                stopped = true;
            },
        ),
    );
    assert.equal(stopped, true);
});

test('a generation quota error keeps its code on the SSE event', () => {
    const payload = streamErrorPayload(new GenerationTemporarilyUnavailableException());
    assert.equal(payload.code, 'GENERATION_TEMPORARILY_UNAVAILABLE');
    assert.equal(payload.retryAfterSeconds, 30);
    assert.match(payload.message, /temporarily unavailable/);
});

test('a plain stream error has only a message', () => {
    assert.deepEqual(streamErrorPayload(new Error('boom')), { message: 'boom' });
    assert.deepEqual(streamErrorPayload('nope'), { message: 'Streaming failed' });
});
