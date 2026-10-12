import assert from 'node:assert/strict';
import test from 'node:test';

import { estimateTokens } from './estimate-tokens.js';

test('estimates about four characters per token', () => {
    assert.equal(estimateTokens(''), 0);
    assert.equal(estimateTokens('   '), 0);
    assert.equal(estimateTokens('Hi'), 1);
    assert.equal(estimateTokens('Hello'), 2);
});
