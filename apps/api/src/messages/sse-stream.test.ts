import assert from 'node:assert/strict';
import test from 'node:test';

import {
    formatSseEvent,
    SSE_KEEPALIVE,
    writeServerSentEvents,
} from './sse-stream.js';

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
