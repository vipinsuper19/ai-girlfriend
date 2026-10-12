import assert from 'node:assert/strict';
import test from 'node:test';

import { replyTargetProblem } from './reply-target.js';

const userLine = { id: 8, role: 'USER', conversationId: 5, deletedAt: null };

test('the latest user line in the conversation can be retried', () => {
    assert.equal(replyTargetProblem(userLine, 5, false), null);
});

test('missing, deleted, assistant, and foreign rows are not found', () => {
    assert.equal(replyTargetProblem(null, 5, false), 'not_found');
    assert.equal(
        replyTargetProblem({ ...userLine, deletedAt: '2026-10-12T00:00:00.000Z' }, 5, false),
        'not_found',
    );
    assert.equal(
        replyTargetProblem({ ...userLine, role: 'ASSISTANT' }, 5, false),
        'not_found',
    );
    assert.equal(replyTargetProblem(userLine, 9, false), 'not_found');
});

test('an older user line is not the latest', () => {
    assert.equal(replyTargetProblem(userLine, 5, true), 'not_latest');
});
