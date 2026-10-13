import assert from 'node:assert/strict';
import test from 'node:test';

import {
    DEFAULT_RETRY_AFTER_SECONDS,
    generationRateLimit,
    GenerationRateLimitedException,
    isGenerationRateLimited,
    retryAfterSecondsFrom,
} from './generation-rate-limit.js';
import { GeminiChatProvider } from './providers/gemini-chat-provider.js';

function apiError(status: number, message: string) {
    const error = new Error(message) as Error & { status: number };
    error.name = 'ApiError';
    error.status = status;
    return error;
}

const QUOTA_BODY = JSON.stringify({
    error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '42s' }],
    },
});

test('matches on status or code only, not message text', () => {
    assert.equal(isGenerationRateLimited(apiError(429, 'x')), true);
    assert.equal(isGenerationRateLimited({ code: 'RESOURCE_EXHAUSTED' }), true);
    assert.equal(isGenerationRateLimited({ status: 'RESOURCE_EXHAUSTED' }), true);
    assert.equal(isGenerationRateLimited(apiError(400, 'quota rate limit 429 RESOURCE_EXHAUSTED')), false);
    assert.equal(isGenerationRateLimited(new Error('429 rate limit quota')), false);
    assert.equal(isGenerationRateLimited(null), false);
});

test('retryAfterSeconds comes from provider retry info, else 30', () => {
    assert.equal(retryAfterSecondsFrom(apiError(429, QUOTA_BODY)), 42);
    assert.equal(retryAfterSecondsFrom({ status: 429, retryAfter: '12' }), 12);
    assert.equal(retryAfterSecondsFrom({ status: 429, headers: new Headers({ 'retry-after': '9' }) }), 9);
    assert.equal(retryAfterSecondsFrom(apiError(429, 'Too many requests')), DEFAULT_RETRY_AFTER_SECONDS);
    assert.equal(DEFAULT_RETRY_AFTER_SECONDS, 30);
});

test('logs generation.rate_limited without user text', () => {
    const logs: string[] = [];
    const mapped = generationRateLimit(
        apiError(429, QUOTA_BODY),
        { provider: 'gemini', model: 'm', mode: 'stream' },
        { warn: (line) => logs.push(line) },
    );
    assert.ok(mapped instanceof GenerationRateLimitedException);
    assert.equal(mapped.getStatus(), 429);
    assert.deepEqual(mapped.getResponse(), {
        code: 'RATE_LIMITED',
        message: 'Give me a moment, then try again.',
        retryAfterSeconds: 42,
    });
    assert.deepEqual(logs, ['generation.rate_limited provider=gemini model=m mode=stream retryAfterSeconds=42']);
    assert.equal(generationRateLimit(apiError(500, 'boom'), { provider: 'gemini', model: 'm', mode: 'stream' }, { warn: () => assert.fail() }), null);
});

function providerWith(models: unknown) {
    const previous = process.env['GEMINI_API_KEY'];
    process.env['GEMINI_API_KEY'] = 'AIzaSyTESTKEY000000000';
    const provider = new GeminiChatProvider();
    if (previous === undefined) delete process.env['GEMINI_API_KEY'];
    else process.env['GEMINI_API_KEY'] = previous;
    (provider as unknown as { client: unknown }).client = { models };
    return provider;
}

test('the Gemini chat provider maps a 429 on stream and generate', async () => {
    const provider = providerWith({
        async generateContentStream() {
            throw apiError(429, QUOTA_BODY);
        },
        async generateContent() {
            throw apiError(429, 'Too many requests');
        },
    });
    const messages = [{ role: 'user' as const, content: 'hi' }];
    await assert.rejects(
        async () => {
            for await (const _chunk of provider.streamChat({ messages })) void _chunk;
        },
        (error: unknown) => error instanceof GenerationRateLimitedException && error.retryAfterSeconds === 42,
    );
    await assert.rejects(
        () => provider.generateChat({ messages }),
        (error: unknown) => error instanceof GenerationRateLimitedException && error.retryAfterSeconds === 30,
    );
});

test('other provider errors keep the generic failure', async () => {
    const original = console.error;
    console.error = () => {};
    try {
        const provider = providerWith({
            async generateContentStream() {
                throw apiError(400, 'RESOURCE_EXHAUSTED quota');
            },
        });
        await assert.rejects(
            async () => {
                for await (const _chunk of provider.streamChat({ messages: [{ role: 'user', content: 'hi' }] })) void _chunk;
            },
            (error: unknown) => !(error instanceof GenerationRateLimitedException) && /Failed to stream/.test(String((error as Error).message)),
        );
    } finally {
        console.error = original;
    }
});
