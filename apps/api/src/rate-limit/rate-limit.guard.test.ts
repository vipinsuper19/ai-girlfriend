import assert from 'node:assert/strict';
import test from 'node:test';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import { RateLimitGuard } from './rate-limit.guard.js';
import { RateLimitedException } from './rate-limit.exception.js';
import type { RateLimitService } from './rate-limit.service.js';

function context(request: object): ExecutionContext {
    return {
        getHandler: () => 'handler',
        getClass: () => 'class',
        switchToHttp: () => ({
            getRequest: () => request,
        }),
    } as unknown as ExecutionContext;
}

test('routes without metadata are not limited', () => {
    let called = false;
    const guard = new RateLimitGuard(
        { getAllAndOverride: () => undefined } as unknown as Reflector,
        { enforce() { called = true; } } as unknown as RateLimitService,
    );
    assert.equal(guard.canActivate(context({})), true);
    assert.equal(called, false);
});

test('a decorated route limits by ip and subject', () => {
    const seen: unknown[] = [];
    const guard = new RateLimitGuard(
        { getAllAndOverride: () => 'login' } as unknown as Reflector,
        {
            enforce(...args: unknown[]) {
                seen.push(args);
            },
        } as unknown as RateLimitService,
    );

    assert.equal(
        guard.canActivate(context({
            ip: '203.0.113.9',
            body: { email: 'Person@Example.com' },
        })),
        true,
    );
    assert.deepEqual(seen, [[
        'login',
        '203.0.113.9',
        'email:person@example.com',
    ]]);
});

test('a rejected limit surfaces as 429', () => {
    const guard = new RateLimitGuard(
        { getAllAndOverride: () => 'messages' } as unknown as Reflector,
        {
            enforce() {
                throw new RateLimitedException(4);
            },
        } as unknown as RateLimitService,
    );

    assert.throws(
        () => guard.canActivate(context({ ip: '127.0.0.1', user: { sub: '3' } })),
        RateLimitedException,
    );
});
