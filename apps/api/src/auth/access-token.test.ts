import assert from 'node:assert/strict';
import test from 'node:test';

import {
    accessTokenExpiresIn,
    DEFAULT_ACCESS_TOKEN_TTL,
} from './access-token.js';

test('login and refresh share a 15 minute access-token fallback', () => {
    assert.equal(accessTokenExpiresIn({}), DEFAULT_ACCESS_TOKEN_TTL);
    assert.equal(DEFAULT_ACCESS_TOKEN_TTL, '15m');
});

test('JWT_ACCESS_EXPIRES_IN overrides the fallback', () => {
    assert.equal(
        accessTokenExpiresIn({ JWT_ACCESS_EXPIRES_IN: '30d' }),
        '30d',
    );
});
