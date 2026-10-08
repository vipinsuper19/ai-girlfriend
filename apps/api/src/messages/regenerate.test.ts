import assert from 'node:assert/strict';
import test from 'node:test';

import { regenerateProblem } from './regenerate.js';

test('her latest reply can be regenerated', () => {
    const reply = { id: 9, role: 'ASSISTANT' };
    assert.equal(regenerateProblem(reply, reply), null);
});

test('older replies, user lines, and deleted rows cannot', () => {
    assert.equal(
        regenerateProblem({ id: 7, role: 'ASSISTANT' }, { id: 9, role: 'ASSISTANT' }),
        'Only her latest reply can be regenerated',
    );
    assert.equal(
        regenerateProblem({ id: 9, role: 'USER' }, { id: 9, role: 'USER' }),
        'Only her replies can be regenerated',
    );
    assert.equal(
        regenerateProblem({ id: 9, role: 'ASSISTANT', deletedAt: '2026-10-01' }, null),
        'Message not found',
    );
    assert.equal(regenerateProblem(null, null), 'Message not found');
});
