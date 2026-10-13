import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiError } from '@google/genai';

import type { ContentModerator } from './content-moderator.js';
import {
    GeminiContentModerator,
    GEMINI_MODERATION_MODEL,
    GEMINI_MODERATION_TIMEOUT_MS,
} from './gemini-moderator.js';
import {
    describeProviderFailure,
    ModerationService,
    redactProviderMessage,
} from './moderation.service.js';
import { safetyConfigFromEnv } from './safety.config.js';

const API_KEY = 'AIzaSyCANARYKEY1234567890';
const FOUR_CATEGORIES = [
    'HARM_CATEGORY_HARASSMENT',
    'HARM_CATEGORY_HATE_SPEECH',
    'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    'HARM_CATEGORY_DANGEROUS_CONTENT',
];

function serviceFor(provider: ContentModerator, logs: string[]) {
    return new ModerationService(
        safetyConfigFromEnv({ MODERATION_PROVIDER: 'gemini', MODERATION_FAIL_CLOSED: 'true' }),
        provider,
        { warn(message) { logs.push(message); } },
    );
}

test('an ApiError is logged with status and message, and the key and persona text are not', async () => {
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

    const logs: string[] = [];
    const provider: ContentModerator = {
        id: 'gemini',
        model: GEMINI_MODERATION_MODEL,
        async moderate() {
            throw new ApiError({ status: 400, message: raw });
        },
    };
    await serviceFor(provider, logs).assertSafePersona({ name: 'Aria' });
    const line = logs.find((entry) => entry.startsWith('moderation.provider_error')) ?? '';
    assert.match(line, /provider=gemini status=http code=400/);
    assert.match(line, /model=gemini-3\.5-flash-lite/);
    assert.match(line, /latencyMs=\d+/);
    assert.match(line, /message=.*INVALID_ARGUMENT/);
    assert.equal(line.includes(API_KEY), false);
    assert.equal(line.includes('Aria'), false);
    assert.match(
        logs.find((entry) => entry.startsWith('safety ')) ?? '',
        /degraded provider=gemini reason=unavailable surface=persona/,
    );
});

test('timeouts and parse errors are classified without logging the body', () => {
    const timeout = describeProviderFailure(
        Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
        'Aria is kind',
    );
    assert.equal(timeout.status, 'timeout');
    assert.equal(timeout.code, 'AbortError');
    assert.equal(timeout.message, '');

    const parsed = describeProviderFailure(
        new Error('Moderation classifier returned an empty response'),
        'Aria is kind',
    );
    assert.equal(parsed.status, 'parse');
    assert.equal(parsed.code, 'parse');
    assert.equal(parsed.message, '');

    const echoed = describeProviderFailure(
        new Error('upstream echoed Aria is kind'),
        'Aria is kind',
    );
    assert.equal(echoed.status, 'http');
    assert.equal(echoed.code, 'unknown');
    assert.equal(echoed.message, '');
});

test('generateContent sends exactly four safety categories and no server deadline under 10s', async () => {
    assert.equal(GEMINI_MODERATION_MODEL, 'gemini-3.5-flash-lite');
    assert.equal(GEMINI_MODERATION_TIMEOUT_MS, 12_000);
    assert.ok(GEMINI_MODERATION_TIMEOUT_MS >= 10_000);

    let deadline: string | null = null;
    let body = '';
    let url = '';
    let sawSignal = false;
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = input instanceof Request ? input : new Request(input, init);
        deadline = request.headers.get('x-server-timeout');
        url = request.url;
        sawSignal = request.signal instanceof AbortSignal;
        body = await request.clone().text();
        return new Response(JSON.stringify({
            candidates: [
                {
                    content: {
                        parts: [{ text: '{"flagged":false,"categories":[]}' }],
                        role: 'model',
                    },
                    finishReason: 'STOP',
                },
            ],
        }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        });
    }) as typeof fetch;

    try {
        const moderator = new GeminiContentModerator(API_KEY, GEMINI_MODERATION_MODEL);
        const result = await moderator.moderate('Aria');
        assert.deepEqual(result.categories, []);
    } finally {
        globalThis.fetch = original;
    }

    const seconds = deadline == null || deadline === '' ? null : Number(deadline);
    assert.ok(seconds === null || seconds >= 10, `X-Server-Timeout=${deadline}`);
    assert.equal(sawSignal, true);
    assert.equal(body.includes(API_KEY), false);
    assert.equal(body.includes('HARM_CATEGORY_JAILBREAK'), false);
    assert.equal(body.includes('HARM_CATEGORY_CIVIC_INTEGRITY'), false);
    assert.equal(url.includes('gemini-3.5-flash-lite'), true);
    assert.equal(body.includes('gemini-3.6-flash'), false);
    const sent = [...body.matchAll(/HARM_CATEGORY_[A-Z_]+/g)].map((match) => match[0]);
    assert.deepEqual(sent, FOUR_CATEGORIES);
});
