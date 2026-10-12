import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException, HttpStatus, type ArgumentsHost } from '@nestjs/common';

import { AGE_UNDER_18, AgeRejectedException } from '../../auth/age.js';
import { RateLimitedException } from '../../rate-limit/rate-limit.exception.js';
import { UsageLimitExceededException } from '../../usage/usage.exceptions.js';
import { HttpExceptionFilter } from './http-exception.filter.js';

function capture(exception: unknown) {
    const headers: Record<string, string> = {};
    const json = (body: unknown) => {
        captured = body;
    };
    let captured: unknown;
    const host = {
        switchToHttp: () => ({
            getResponse: () => ({
                setHeader: (name: string, value: string) => {
                    headers[name] = value;
                },
                status: () => ({ json }),
            }),
            getRequest: () => ({
                method: 'POST',
                url: '/api/v1/usage',
                originalUrl: '/api/v1/usage',
            }),
        }),
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter().catch(exception, host);
    return {
        body: captured as {
            code?: string;
            message: string | string[];
            statusCode: number;
            feature?: string;
            limit?: number;
            used?: number;
            remaining?: number;
            period?: string;
            resetsAt?: string;
            retryAfterSeconds?: number;
        },
        headers,
    };
}

test('forwards the usage limit code', () => {
    const { body } = capture(
        new UsageLimitExceededException('MESSAGES', 100, 100, 1),
    );

    assert.equal(body.statusCode, 403);
    assert.equal(body.code, 'USAGE_LIMIT_EXCEEDED');
    assert.equal(body.message, 'Usage limit exceeded for MESSAGES');
    assert.equal(body.remaining, 0);
});

test('a daily free-tier cap says when it resets', () => {
    const { body } = capture(
        new UsageLimitExceededException('TEXT_TOKENS', 50_000, 50_000, 1, {
            period: 'day',
            resetsAt: '2026-10-13T00:00:00.000Z',
        }),
    );

    assert.equal(body.statusCode, 403);
    assert.equal(body.code, 'USAGE_LIMIT_EXCEEDED');
    assert.equal(body.message, 'Free tier daily limit reached for TEXT_TOKENS');
    assert.equal(body.period, 'day');
    assert.equal(body.resetsAt, '2026-10-13T00:00:00.000Z');
    assert.equal(body.limit, 50_000);
});

test('rate limits are 429 with Retry-After', () => {
    const { body, headers } = capture(new RateLimitedException(12));

    assert.equal(body.statusCode, 429);
    assert.equal(body.code, 'RATE_LIMITED');
    assert.equal(body.retryAfterSeconds, 12);
    assert.equal(headers['Retry-After'], '12');
});

test('forwards the under-18 code', () => {
    const { body } = capture(
        new AgeRejectedException(
            AGE_UNDER_18,
            'You must be 18 or older.',
            HttpStatus.FORBIDDEN,
        ),
    );

    assert.equal(body.statusCode, 403);
    assert.equal(body.code, 'UNDER_18');
    assert.equal(body.message, 'You must be 18 or older.');
});

test('leaves validation errors without a code', () => {
    const { body } = capture(
        new BadRequestException(['content should not be empty']),
    );

    assert.equal(body.statusCode, 400);
    assert.equal(body.code, undefined);
    assert.deepEqual(body.message, ['content should not be empty']);
});
