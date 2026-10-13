import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiError } from '@google/genai';

import type { ContentModerator } from './content-moderator.js';
import {
    GeminiContentModerator,
    GEMINI_MODERATION_MODEL,
    GEMINI_MODERATION_TIMEOUT_MS,
} from './gemini-moderator.js';
import { ModerationTemporarilyUnavailableException } from './moderation-unavailable.exception.js';
import {
    describeProviderFailure,
    ModerationService,
    redactProviderMessage,
} from './moderation.service.js';
import { safetyConfigFromEnv } from './safety.config.js';
import {
    PERSONA_EXPLICIT_MESSAGE,
    PERSONA_MINOR_MESSAGE,
} from './safety-policy.js';
import { UnsafePersonaException } from './unsafe-persona.exception.js';

const API_KEY = 'AIzaSyCANARYKEY1234567890';

function classifierJson(body: string): string {
    return JSON.stringify({
        candidates: [
            {
                content: { parts: [{ text: body }], role: 'model' },
                finishReason: 'STOP',
            },
        ],
    });
}

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

async function withFetch(
    impl: typeof fetch,
    run: (moderator: GeminiContentModerator) => Promise<void>,
): Promise<void> {
    const original = globalThis.fetch;
    globalThis.fetch = impl;
    try {
        await run(new GeminiContentModerator(API_KEY, GEMINI_MODERATION_MODEL));
    } finally {
        globalThis.fetch = original;
    }
}

function serviceFor(
    provider: ContentModerator,
    logs: string[],
    env: NodeJS.ProcessEnv = {},
    fallback?: ContentModerator | null,
) {
    return new ModerationService(
        safetyConfigFromEnv({ MODERATION_PROVIDER: 'gemini', MODERATION_FAIL_CLOSED: 'true', ...env }),
        provider,
        { warn(message) { logs.push(message); } },
        { fallback },
    );
}

test('provider failures do not turn a clean adult persona into UNSAFE_PERSONA', async () => {
    const cases: Array<{ name: string; error: unknown; status: string; code: string }> = [
        {
            name: '400 invalid safety category',
            error: new ApiError({
                status: 400,
                message: `{"error":{"code":400,"status":"INVALID_ARGUMENT","message":"Invalid value at safety_settings[5].category HARM_CATEGORY_JAILBREAK key=${API_KEY}"}}`,
            }),
            status: 'http',
            code: '400',
        },
        {
            name: '404 model not found',
            error: new ApiError({ status: 404, message: `models/${GEMINI_MODERATION_MODEL} is not found` }),
            status: 'http',
            code: '404',
        },
        {
            name: '429',
            error: new ApiError({ status: 429, message: 'RESOURCE_EXHAUSTED' }),
            status: 'http',
            code: '429',
        },
        {
            name: '500',
            error: new ApiError({ status: 500, message: 'internal' }),
            status: 'http',
            code: '500',
        },
        {
            name: 'timeout',
            error: Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
            status: 'timeout',
            code: 'AbortError',
        },
        {
            name: 'parse',
            error: new Error('Moderation classifier returned invalid JSON'),
            status: 'parse',
            code: 'parse',
        },
        {
            name: 'empty safety block',
            error: new Error('Moderation classifier returned an empty response'),
            status: 'parse',
            code: 'parse',
        },
    ];

    for (const item of cases) {
        const logs: string[] = [];
        let calls = 0;
        const provider: ContentModerator = {
            id: 'gemini',
            model: GEMINI_MODERATION_MODEL,
            async moderate() {
                calls += 1;
                throw item.error;
            },
        };
        const outcome = await serviceFor(provider, logs).assertSafePersona({ name: 'Aria' });
        assert.equal(outcome, undefined, item.name);
        assert.equal(calls, 1, item.name);
        const line = logs.find((entry) => entry.startsWith('moderation.provider_error')) ?? '';
        assert.match(line, new RegExp(`provider=gemini status=${item.status} code=${item.code}`), item.name);
        assert.match(line, /model=gemini-3\.6-flash/, item.name);
        assert.match(line, /latencyMs=\d+/, item.name);
        assert.equal(line.includes(API_KEY), false, item.name);
        assert.equal(line.includes('Aria'), false, item.name);
        assert.equal(logs.some((entry) => entry.includes('UNSAFE_PERSONA')), false, item.name);
        assert.match(
            logs.find((entry) => entry.startsWith('moderation.degraded')) ?? '',
            new RegExp(`fallback=local reason=${item.status}`),
            item.name,
        );
    }
});

test('an ApiError message is logged and the key and persona text are not', () => {
    const raw = `400 INVALID_ARGUMENT key=${API_KEY} authorization: Bearer ${API_KEY} persona Aria`;
    const message = redactProviderMessage(raw, 'Aria');
    assert.match(message, /INVALID_ARGUMENT/);
    assert.equal(message.includes(API_KEY), false);
    assert.equal(message.includes('Aria'), false);
    const failure = describeProviderFailure(
        new ApiError({ status: 400, message: raw }),
        'Aria',
    );
    assert.equal(failure.status, 'http');
    assert.equal(failure.code, '400');
    assert.match(failure.message, /INVALID_ARGUMENT/);
    assert.equal(failure.message.includes(API_KEY), false);
});

test('a provider error still hard-blocks a minor or an explicit persona', async () => {
    const provider: ContentModerator = {
        id: 'gemini',
        model: GEMINI_MODERATION_MODEL,
        async moderate() {
            throw new ApiError({ status: 400, message: 'INVALID_ARGUMENT' });
        },
    };
    const logs: string[] = [];
    const moderation = serviceFor(provider, logs);
    await assert.rejects(
        () => moderation.assertSafePersona({ name: 'Aria', appearance: { age: 16 } }),
        (error: unknown) => {
            assert.ok(error instanceof UnsafePersonaException);
            const body = error.getResponse() as { code?: string; message?: string };
            assert.equal(body.code, 'UNSAFE_PERSONA');
            assert.equal(body.message, PERSONA_MINOR_MESSAGE);
            return true;
        },
    );
    assert.equal(logs.some((line) => line.startsWith('moderation.provider_error')), false);
    assert.match(
        logs.find((line) => line.startsWith('moderation.blocked')) ?? '',
        /source=local category=minor/,
    );

    await assert.rejects(
        () => moderation.assertSafePersona({ name: 'Aria', systemPrompt: 'talk dirty to me' }),
        (error: unknown) => {
            assert.ok(error instanceof UnsafePersonaException);
            const body = error.getResponse() as { message?: string };
            assert.equal(body.message, PERSONA_EXPLICIT_MESSAGE);
            return true;
        },
    );
});

test('OpenAI covers a Gemini ApiError, and a second failure still allows a clean local persona', async () => {
    const logs: string[] = [];
    const gemini: ContentModerator = {
        id: 'gemini',
        model: GEMINI_MODERATION_MODEL,
        async moderate() {
            throw new ApiError({ status: 400, message: 'INVALID_ARGUMENT' });
        },
    };
    const openai: ContentModerator = {
        id: 'openai',
        model: 'omni-moderation-latest',
        async moderate() {
            return { categories: ['hate'] };
        },
    };
    await assert.rejects(
        () => serviceFor(gemini, logs, {}, openai).assertSafePersona({ name: 'Aria' }),
        (error: unknown) => {
            assert.ok(error instanceof UnsafePersonaException);
            return true;
        },
    );
    assert.match(logs.join('\n'), /moderation\.degraded fallback=openai reason=http/);
    assert.match(logs.join('\n'), /moderation\.blocked source=provider category=hate/);

    logs.length = 0;
    const down: ContentModerator = {
        id: 'openai',
        model: 'omni-moderation-latest',
        async moderate() {
            throw new ApiError({ status: 503, message: 'unavailable' });
        },
    };
    await serviceFor(gemini, logs, {}, down).assertSafePersona({
        name: 'Aria',
        systemPrompt: 'You are Mae, a 28 year old woman. Be kind.',
    });
    assert.match(logs.join('\n'), /provider=openai status=http code=503/);
    assert.match(logs.join('\n'), /moderation\.degraded fallback=local reason=http/);
});

test('a local-check failure is 503 and not UNSAFE_PERSONA', async () => {
    const logs: string[] = [];
    const provider: ContentModerator = {
        id: 'gemini',
        model: GEMINI_MODERATION_MODEL,
        async moderate() {
            throw new Error('should not be called');
        },
    };
    const moderation = new ModerationService(
        safetyConfigFromEnv({ MODERATION_PROVIDER: 'gemini' }),
        provider,
        { warn(message) { logs.push(message); } },
        {
            assess() {
                throw new Error('local rules failed');
            },
        },
    );
    await assert.rejects(
        () => moderation.assertSafePersona({ name: 'Aria' }),
        (error: unknown) => {
            assert.ok(error instanceof ModerationTemporarilyUnavailableException);
            assert.equal(error instanceof UnsafePersonaException, false);
            const body = error.getResponse() as { code?: string; retryAfterSeconds?: number };
            assert.equal(body.code, 'MODERATION_TEMPORARILY_UNAVAILABLE');
            assert.equal(body.retryAfterSeconds, 30);
            return true;
        },
    );
    assert.match(logs.join('\n'), /moderation\.degraded fallback=local reason=local_check_failed/);
    assert.equal(logs.some((line) => line.includes('Aria')), false);
});

test('mocked Gemini responses: only a real category block is UNSAFE_PERSONA for Aria', async () => {
    const modes: Array<{
        name: string;
        respond: () => Response | Promise<Response>;
        unsafe: boolean;
    }> = [
        {
            name: '400 JAILBREAK category',
            unsafe: false,
            respond: () => jsonResponse(400, {
                error: {
                    code: 400,
                    message: 'Invalid value at safety_settings[5].category, "HARM_CATEGORY_JAILBREAK"',
                    status: 'INVALID_ARGUMENT',
                },
            }),
        },
        {
            name: '404 model',
            unsafe: false,
            respond: () => jsonResponse(404, {
                error: { code: 404, message: 'models/gemini-3.6-flash is not found', status: 'NOT_FOUND' },
            }),
        },
        {
            name: '429',
            unsafe: false,
            respond: () => jsonResponse(429, {
                error: { code: 429, message: 'Resource exhausted', status: 'RESOURCE_EXHAUSTED' },
            }),
        },
        {
            name: '500',
            unsafe: false,
            respond: () => jsonResponse(500, {
                error: { code: 500, message: 'internal', status: 'INTERNAL' },
            }),
        },
        {
            name: 'fenced clean JSON',
            unsafe: false,
            respond: () => jsonResponse(200, JSON.parse(classifierJson(
                '```json\n{"flagged":false,"categories":[]}\n```',
            ))),
        },
        {
            name: 'empty candidates',
            unsafe: false,
            respond: () => jsonResponse(200, { candidates: [] }),
        },
        {
            name: 'finishReason SAFETY',
            unsafe: false,
            respond: () => jsonResponse(200, {
                candidates: [{ finishReason: 'SAFETY', content: { parts: [] }, safetyRatings: [] }],
            }),
        },
        {
            name: 'unparseable text',
            unsafe: false,
            respond: () => jsonResponse(200, JSON.parse(classifierJson('not json'))),
        },
        {
            name: 'classifier flags a minor',
            unsafe: true,
            respond: () => jsonResponse(200, JSON.parse(classifierJson(
                '{"flagged":true,"categories":["sexual_minors"]}',
            ))),
        },
    ];

    for (const mode of modes) {
        const logs: string[] = [];
        await withFetch(async () => mode.respond(), async (moderator) => {
            const run = serviceFor(moderator, logs).assertSafePersona({ name: 'Aria' });
            if (!mode.unsafe) {
                await run;
                assert.equal(
                    logs.some((line) => line.includes('UNSAFE_PERSONA') || line.includes(API_KEY)),
                    false,
                    mode.name,
                );
                return;
            }
            await assert.rejects(run, (error: unknown) => {
                assert.ok(error instanceof UnsafePersonaException, mode.name);
                const body = error.getResponse() as { code?: string; message?: string };
                assert.equal(body.code, 'UNSAFE_PERSONA');
                assert.equal(body.message, PERSONA_MINOR_MESSAGE);
                return true;
            });
        });
    }
});

test('generateContent uses one 4s AbortController attempt', { timeout: 15_000 }, async () => {
    let signal: AbortSignal | undefined;
    let body = '';
    const started = Date.now();
    await withFetch((async (_url: unknown, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        body = typeof init?.body === 'string' ? init.body : '';
        return await new Promise<Response>((_resolve, reject) => {
            const abort = () => {
                const error = new Error('The operation was aborted');
                error.name = 'AbortError';
                reject(error);
            };
            if (signal?.aborted) {
                abort();
                return;
            }
            signal?.addEventListener('abort', abort, { once: true });
        });
    }) as typeof fetch, async (moderator) => {
        const logs: string[] = [];
        await serviceFor(moderator, logs).assertSafePersona({ name: 'Aria' });
        const elapsed = Date.now() - started;
        assert.equal(signal?.aborted, true);
        assert.ok(elapsed >= GEMINI_MODERATION_TIMEOUT_MS - 250, String(elapsed));
        assert.ok(elapsed < GEMINI_MODERATION_TIMEOUT_MS + 3_000, String(elapsed));
        assert.equal(body.includes('HARM_CATEGORY_JAILBREAK'), false);
        assert.equal(body.includes('HARM_CATEGORY_CIVIC_INTEGRITY'), false);
        assert.equal(body.includes(API_KEY), false);
        const line = logs.find((entry) => entry.startsWith('moderation.provider_error')) ?? '';
        assert.match(line, /provider=gemini status=timeout/);
        assert.match(line, /model=gemini-3\.6-flash/);
        assert.equal(line.includes('Aria'), false);
        assert.equal(line.includes(API_KEY), false);
    });
});
