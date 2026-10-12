import assert from 'node:assert/strict';
import test from 'node:test';

import { clientIp } from './client-ip.js';
import { rateLimitSubject } from './subject-key.js';

test('client ip prefers req.ip and strips the v4-mapped prefix', () => {
    assert.equal(clientIp({ ip: '::ffff:203.0.113.5' }), '203.0.113.5');
    assert.equal(
        clientIp({ socket: { remoteAddress: '198.51.100.8' } }),
        '198.51.100.8',
    );
    assert.equal(clientIp({}), 'unknown');
});

test('subject key prefers the account, then email, then a reset token', () => {
    assert.equal(
        rateLimitSubject({ user: { sub: '9' }, body: { email: 'a@b.co' } }),
        'id:9',
    );
    assert.equal(
        rateLimitSubject({ body: { email: ' A@Example.com ' } }),
        'email:a@example.com',
    );
    assert.equal(
        rateLimitSubject({ body: { token: 'abcdefghijklmnop' } }),
        'token:abcdefghijklmnop',
    );
    assert.equal(rateLimitSubject({ body: {} }), null);
});
