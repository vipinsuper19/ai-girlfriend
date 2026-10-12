import assert from 'node:assert/strict';
import test from 'node:test';

import { streamReply } from './stream-reply.js';

test('persists only after the provider stream finishes', async () => {
    const events = [];
    let persisted = '';

    for await (const event of streamReply({
        chunks: (async function* () {
            yield 'Hel';
            yield 'lo';
        })(),
        persist: async (text) => {
            persisted = text;
            return { id: 4, content: text };
        },
    })) {
        events.push(event);
    }

    assert.equal(persisted, 'Hello');
    assert.deepEqual(events.map((event) => event.type), ['delta', 'delta', 'done']);
});

test('abort before the stream finishes does not persist', async () => {
    const controller = new AbortController();
    let persisted = false;

    const events = [];
    for await (const event of streamReply({
        chunks: (async function* () {
            yield 'Hel';
            controller.abort();
            yield 'lo';
        })(),
        signal: controller.signal,
        persist: async () => {
            persisted = true;
            return { id: 1 };
        },
    })) {
        events.push(event.type);
    }

    assert.equal(persisted, false);
    assert.deepEqual(events, ['delta']);
});

test('an abort error from the provider does not persist', async () => {
    let persisted = false;
    const events = [];
    for await (const event of streamReply({
        chunks: (async function* () {
            yield 'x';
            throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
        })(),
        persist: async () => {
            persisted = true;
            return { id: 1 };
        },
    })) {
        events.push(event);
    }

    assert.equal(persisted, false);
    assert.equal(events.length, 1);
});

test('closing the generator does not persist a partial reply', async () => {
    let persisted = false;
    const iterator = streamReply({
        chunks: (async function* () {
            yield 'Hel';
            yield 'lo';
        })(),
        persist: async () => {
            persisted = true;
            return { id: 1 };
        },
    })[Symbol.asyncIterator]();

    const first = await iterator.next();
    assert.equal(first.value?.type, 'delta');
    await iterator.return(undefined);
    assert.equal(persisted, false);
});

test('an empty provider reply is an error and is not persisted', async () => {
    let persisted = false;
    await assert.rejects(
        (async () => {
            for await (const _event of streamReply({
                chunks: (async function* () {
                    yield '   ';
                })(),
                persist: async () => {
                    persisted = true;
                    return { id: 1 };
                },
            })) {
                // drain
            }
        })(),
        /empty response/,
    );
    assert.equal(persisted, false);
});
