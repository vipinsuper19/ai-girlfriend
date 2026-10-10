import assert from 'node:assert/strict';
import test from 'node:test';

import {
    formatSseEvent,
    SSE_KEEPALIVE,
    streamErrorPayload,
    writeServerSentEvents,
} from './sse-stream.js';
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
        await new Promise((resolve) => setTimeout(resolve, 20_000));
        yield { type: 'delta', content: 'there' };
    }

    const done = writeServerSentEvents(events(), (chunk) => {
        chunks.push(chunk);
    }, 15_000);

    await new Promise((resolve) => setImmediate(resolve));
    assert.match(chunks[0] ?? '', /event: message/);

    t.mock.timers.tick(15_000);
    assert.ok(chunks.includes(SSE_KEEPALIVE));

    t.mock.timers.tick(5_000);
    await done;

    assert.ok(chunks.some((chunk) => chunk.startsWith('event: delta')));
});

test('a stream error keeps the usage limit code', () => {
    const error = new UsageLimitExceededException('MESSAGES', 100, 100, 1);
    assert.deepEqual(streamErrorPayload(error), {
        message: 'Usage limit exceeded for MESSAGES',
        code: 'USAGE_LIMIT_EXCEEDED',
    });
});

test('a plain stream error has only a message', () => {
    assert.deepEqual(streamErrorPayload(new Error('boom')), { message: 'boom' });
    assert.deepEqual(streamErrorPayload('nope'), { message: 'Streaming failed' });
});
