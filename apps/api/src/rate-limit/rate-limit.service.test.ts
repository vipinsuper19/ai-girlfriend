import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { RateLimitedException } from './rate-limit.exception.js';
import { RateLimitService } from './rate-limit.service.js';

describe('rate limit service', { concurrency: false }, () => {
    test('the user cap blocks without using up the ip cap', () => {
        process.env['RATE_LIMIT_LOGIN_IP_MAX'] = '2';
        process.env['RATE_LIMIT_LOGIN_USER_MAX'] = '1';
        process.env['RATE_LIMIT_LOGIN_IP_WINDOW_SEC'] = '60';
        process.env['RATE_LIMIT_LOGIN_USER_WINDOW_SEC'] = '60';
        try {
            const service = new RateLimitService();
            service.enforce('login', '1.1.1.1', 'email:a@b.co', 1_000);
            assert.throws(
                () => service.enforce('login', '1.1.1.1', 'email:a@b.co', 1_000),
                RateLimitedException,
            );
            service.enforce('login', '1.1.1.1', 'email:c@d.co', 1_000);
        } finally {
            delete process.env['RATE_LIMIT_LOGIN_IP_MAX'];
            delete process.env['RATE_LIMIT_LOGIN_USER_MAX'];
            delete process.env['RATE_LIMIT_LOGIN_IP_WINDOW_SEC'];
            delete process.env['RATE_LIMIT_LOGIN_USER_WINDOW_SEC'];
        }
    });
});
