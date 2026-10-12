import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException, HttpStatus, type ArgumentsHost } from '@nestjs/common';

import { AGE_UNDER_18, AgeRejectedException } from '../../auth/age.js';
import { HttpExceptionFilter } from './http-exception.filter.js';
import { UsageLimitExceededException } from '../../usage/usage.exceptions.js';

function capture(exception: unknown) {
    const json = (body: unknown) => {
        captured = body;
    };
    let captured: unknown;
    const host = {
        switchToHttp: () => ({
            getResponse: () => ({
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
    return captured as {
        code?: string;
        message: string | string[];
        statusCode: number;
    };
}

test('forwards the usage limit code', () => {
    const body = capture(
        new UsageLimitExceededException('MESSAGES', 100, 100, 1),
    );

    assert.equal(body.statusCode, 403);
    assert.equal(body.code, 'USAGE_LIMIT_EXCEEDED');
    assert.equal(body.message, 'Usage limit exceeded for MESSAGES');
});

test('forwards the under-18 code', () => {
    const body = capture(
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
    const body = capture(
        new BadRequestException(['content should not be empty']),
    );

    assert.equal(body.statusCode, 400);
    assert.equal(body.code, undefined);
    assert.deepEqual(body.message, ['content should not be empty']);
});
