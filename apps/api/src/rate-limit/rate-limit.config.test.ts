import assert from 'node:assert/strict';
import test from 'node:test';

import { rateLimitConfig } from './rate-limit.config.js';

test('defaults are per route and per dimension', () => {
    const config = rateLimitConfig({});
    assert.equal(config.login.ip.max, 20);
    assert.equal(config.login.ip.windowMs, 15 * 60 * 1000);
    assert.equal(config.login.user.max, 10);
    assert.equal(config.register.ip.max, 10);
    assert.equal(config['password-reset'].user.windowMs, 60 * 60 * 1000);
    assert.equal(config.messages.user.max, 30);
    assert.equal(config.messages.ip.windowMs, 60 * 1000);
});

test('env overrides a dimension and ignores a broken window', () => {
    const config = rateLimitConfig({
        RATE_LIMIT_LOGIN_IP_MAX: '3',
        RATE_LIMIT_LOGIN_IP_WINDOW_SEC: '0',
        RATE_LIMIT_MESSAGES_USER_MAX: 'nope',
    });
    assert.equal(config.login.ip.max, 3);
    assert.equal(config.login.ip.windowMs, 15 * 60 * 1000);
    assert.equal(config.messages.user.max, 30);
});
