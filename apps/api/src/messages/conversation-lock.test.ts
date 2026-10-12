import assert from 'node:assert/strict';
import test from 'node:test';

import { acquireConversationLock } from './conversation-lock.js';

test('a second generation waits until the first releases the conversation', async () => {
    const releaseFirst = await acquireConversationLock(41);
    let second = false;
    const waiting = acquireConversationLock(41).then((release) => {
        second = true;
        release();
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(second, false);
    releaseFirst();
    await waiting;
    assert.equal(second, true);
});

test('different conversations do not block each other', async () => {
    const releaseA = await acquireConversationLock(1);
    let enteredB = false;
    const releaseB = await acquireConversationLock(2);
    enteredB = true;
    releaseB();
    releaseA();
    assert.equal(enteredB, true);
});
