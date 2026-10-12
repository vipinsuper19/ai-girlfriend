import assert from 'node:assert/strict';
import test from 'node:test';

import { isAbortError } from './abort-error.js';

test('recognises abort errors, including a wrapped cause', () => {
    assert.equal(isAbortError(Object.assign(new Error('x'), { name: 'AbortError' })), true);
    assert.equal(isAbortError(Object.assign(new Error('x'), { name: 'APIUserAbortError' })), true);
    assert.equal(
        isAbortError(Object.assign(new Error('wrapped'), {
            cause: Object.assign(new Error('inner'), { name: 'AbortError' }),
        })),
        true,
    );
    assert.equal(isAbortError(new Error('provider down')), false);
    assert.equal(isAbortError('nope'), false);
});
