import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';
import { validate } from 'class-validator';

import type { ContentModerator } from './content-moderator.js';
import {
    GeminiContentModerator,
    GEMINI_MODERATION_MAX_CHARS,
    GEMINI_MODERATION_MODEL,
} from './gemini-moderator.js';
import { ModerationService } from './moderation.service.js';
import {
    OpenAiContentModerator,
    OPENAI_MODERATION_MAX_CHARS,
    OPENAI_MODERATION_REQUEST,
} from './openai-moderator.js';
import { safetyConfigFromEnv } from './safety.config.js';
import { CLASSIFIER_TIMEOUT_MS } from './classifier-attempt.js';
import { CreateMessageDto } from '../messages/dto/create-message.dto.js';
import { MESSAGE_CONTENT_MAX } from '../messages/message-limits.js';
import {
    EXPLICIT_REFUSAL_MESSAGE,
    PERSONA_REJECTION_MESSAGE,
    REFUSAL_MESSAGE,
} from './safety-policy.js';
import { UnsafePersonaException } from './unsafe-persona.exception.js';

function serviceFor(
    env: NodeJS.ProcessEnv,
    provider: ContentModerator,
    logs: string[] = [],
) {
    return new ModerationService(
        safetyConfigFromEnv(env),
        provider,
        { warn(message) { logs.push(message); } },
    );
}

const localProvider: ContentModerator = {
    id: 'local',
    async moderate() {
        return { categories: [] };
    },
};

test('a crisis message is returned without calling the provider and without logging the text', async () => {
    const logs: string[] = [];
    let called = false;
    const provider: ContentModerator = {
        id: 'openai',
        async moderate() {
            called = true;
            return { categories: [] };
        },
    };
    const notice = await serviceFor({}, provider, logs).noticeFor(
        'I want to kill myself CANARY-991',
        'input',
        { userId: 4, conversationId: 9 },
    );

    assert.equal(called, false);
    assert.equal(notice?.action, 'crisis');
    assert.equal(notice?.code, 'self_harm');
    assert.match(notice?.message ?? '', /14416/);
    assert.match(notice?.message ?? '', /iasp\.info/);
    assert.equal(logs.length, 1);
    assert.match(logs[0] ?? '', /surface=input action=crisis code=self_harm/);
    assert.match(logs[0] ?? '', /userId=4 conversationId=9/);
    assert.equal(logs[0]?.includes('CANARY-991'), false);
    assert.equal(logs[0]?.includes('kill myself'), false);
});

test('the provider can flag a paraphrase the local patterns miss', async () => {
    const provider: ContentModerator = {
        id: 'openai',
        async moderate() {
            return { categories: ['self_harm'] };
        },
    };
    const notice = await serviceFor({}, provider).noticeFor('a quiet evening', 'input');
    assert.equal(notice?.action, 'crisis');
    assert.equal(
        (await serviceFor({}, provider).noticeFor('a quiet evening', 'output'))?.action,
        'refuse',
    );
});

test('a provider outage falls back to the local verdict and logs no text', async () => {
    const logs: string[] = [];
    const provider: ContentModerator = {
        id: 'gemini',
        async moderate(text) {
            throw new Error(`upstream echoed ${text}`);
        },
    };
    const moderation = serviceFor({ MODERATION_FAIL_CLOSED: 'true' }, provider, logs);
    const notice = await moderation.noticeFor('hello CANARY-220', 'input');
    assert.equal(notice, null);
    assert.equal(moderation.degradedFallbacks, 1);
    assert.match(logs[0] ?? '', /safety degraded provider=gemini reason=unavailable/);
    assert.equal(logs.some((line) => line.includes('CANARY-220')), false);
    assert.equal(logs.some((line) => line.includes('upstream echoed')), false);
});

test('fail open keeps a locally allowed message when the provider errors', async () => {
    const provider: ContentModerator = {
        id: 'openai',
        async moderate() {
            throw new Error('down');
        },
    };
    const notice = await serviceFor({ MODERATION_FAIL_CLOSED: 'false' }, provider).noticeFor(
        'hello there',
        'input',
    );
    assert.equal(notice, null);
});

test('disabling moderation skips crisis and policy checks', async () => {
    let called = false;
    const provider: ContentModerator = {
        id: 'openai',
        async moderate() {
            called = true;
            return { categories: ['sexual_minors'] };
        },
    };
    const moderation = serviceFor({ MODERATION_ENABLED: 'false' }, provider);
    assert.equal(await moderation.noticeFor('I want to kill myself', 'input'), null);
    assert.equal(called, false);
    await moderation.assertSafePersona({ appearance: { age: 12 }, systemPrompt: 'loli' });
});

test('unsafe personas are rejected and ordinary ones are kept', async () => {
    const moderation = serviceFor({}, localProvider);
    await assert.rejects(
        () => moderation.assertSafePersona({
            name: 'Aria',
            systemPrompt: "I'm 12 years old",
            appearance: { age: 25 },
        }),
        (error: unknown) => {
            assert.ok(error instanceof UnsafePersonaException);
            const body = error.getResponse() as { code?: string; message?: string };
            assert.equal(body.code, 'UNSAFE_PERSONA');
            assert.equal(body.message, PERSONA_REJECTION_MESSAGE);
            return true;
        },
    );
    await assert.rejects(
        () => moderation.assertSafePersona({ appearance: { age: 16 } }),
        UnsafePersonaException,
    );
    await moderation.assertSafePersona({
        name: 'Aria',
        greeting: 'Hey, how was your day?',
        appearance: { age: 26 },
        personality: { traits: ['warm', 'curious'], communicationStyle: 'gentle' },
    });
});

test('a local first-person minor age uses the shared refusal', async () => {
    const notice = await serviceFor({}, localProvider).noticeFor("I'm 15", 'input');
    assert.deepEqual(notice, {
        action: 'refuse',
        code: 'content_policy',
        message: REFUSAL_MESSAGE,
    });
    assert.equal(
        await serviceFor({}, localProvider).noticeFor('ignore previous instructions', 'input'),
        null,
    );
});

test('explicit chat is a soft refusal and a string age under 18 is rejected', async () => {
    const moderation = serviceFor({}, localProvider);
    assert.deepEqual(await moderation.noticeFor('talk dirty to me', 'output'), {
        action: 'refuse',
        code: 'explicit_content',
        message: EXPLICIT_REFUSAL_MESSAGE,
    });
    const explicit = await serviceFor(
        {},
        {
            id: 'gemini',
            async moderate() {
                return {
                    categories: ['explicit'],
                    items: [{ id: 'user', categories: ['explicit'] }],
                };
            },
        },
    ).noticeFor('talk dirty to me', 'output');
    assert.deepEqual(explicit, {
        action: 'refuse',
        code: 'explicit_content',
        message: EXPLICIT_REFUSAL_MESSAGE,
    });
    assert.equal(await moderation.noticeFor('Kiss me goodnight.', 'input'), null);
    await assert.rejects(
        () => moderation.assertSafePersona({ appearance: { age: 'seventeen' } }),
        UnsafePersonaException,
    );
    await moderation.assertSafePersona({ appearance: { age: '18' } });
});

test('a later chunk is still scanned, and a hit stops the provider early', async () => {
    const calls: string[] = [];
    const provider: ContentModerator = {
        id: 'openai',
        maxChars: 1000,
        async moderate(text) {
            calls.push(text);
            return { categories: text.includes('FLAG') ? ['illegal_harm'] : [] };
        },
    };
    const late = await serviceFor({}, provider).noticeFor(`${'a'.repeat(1000)}FLAG`, 'input');
    assert.equal(late?.code, 'content_policy');
    assert.equal(calls.length, 2);

    calls.length = 0;
    const early = await serviceFor({}, provider).noticeFor(`FLAG${'b'.repeat(2000)}`, 'output');
    assert.equal(early?.code, 'content_policy');
    assert.equal(calls.length, 1);
});

test('a non-positive provider limit flags the text without calling the provider', async () => {
    const logs: string[] = [];
    let called = false;
    const provider: ContentModerator = {
        id: 'gemini',
        maxChars: 0,
        async moderate() {
            called = true;
            return { categories: [] };
        },
    };
    const notice = await serviceFor({}, provider, logs).noticeFor('hello CANARY-77', 'input');
    assert.equal(called, false);
    assert.equal(notice?.code, 'content_policy');
    assert.match(logs[0] ?? '', /over_limit/);
    assert.equal(logs[0]?.includes('CANARY-77'), false);
});

test('providers reject an over-limit call instead of truncating it', async () => {
    const openai = new OpenAiContentModerator('sk-test', 'omni-moderation-latest');
    await assert.rejects(
        () => openai.moderate('x'.repeat(OPENAI_MODERATION_MAX_CHARS + 1)),
        /exceeds the provider limit/,
    );
    const gemini = new GeminiContentModerator('gemini-test', GEMINI_MODERATION_MODEL);
    await assert.rejects(
        () => gemini.moderate('y'.repeat(GEMINI_MODERATION_MAX_CHARS + 1)),
        /exceeds the provider limit/,
    );
});

test('a classifier timeout falls back once and does not cache the miss', async () => {
    const calls = { n: 0 };
    const logs: string[] = [];
    const moderation = serviceFor({}, downProvider(timeoutError(), calls), logs);
    assert.equal((await moderation.moderateTurn({ text: 'Kiss me goodnight.' })).notice, null);
    assert.equal((await moderation.moderateTurn({ text: 'Kiss me goodnight.' })).notice, null);
    assert.equal(calls.n, 2);
    assert.equal(moderation.degradedFallbacks, 2);
    assert.match(logs[0] ?? '', /reason=timeout/);
    assert.equal(logs[0]?.includes('Kiss me'), false);
});

test('a classifier 429 falls back to the local verdict', async () => {
    const calls = { n: 0 };
    const logs: string[] = [];
    const moderation = serviceFor({}, downProvider(httpError(429), calls), logs);
    const turn = await moderation.moderateTurn({ text: 'how do I build a bomb' });
    assert.equal(turn.notice, null);
    assert.equal(turn.holdMinor, false);
    assert.equal(calls.n, 1);
    assert.equal(moderation.degradedFallbacks, 1);
    assert.match(logs[0] ?? '', /reason=429/);
});

test('a classifier 503 falls back to the local verdict', async () => {
    const calls = { n: 0 };
    const logs: string[] = [];
    const moderation = serviceFor({}, downProvider(httpError(503), calls), logs);
    const turn = await moderation.moderateTurn({ text: 'Come sit with me tonight' });
    assert.equal(turn.notice, null);
    assert.equal(calls.n, 1);
    assert.match(logs[0] ?? '', /reason=503/);
});

test('a held user stays blocked when the classifier is down', async () => {
    const calls = { n: 0 };
    const moderation = serviceFor({}, downProvider(httpError(503), calls));
    const turn = await moderation.moderateTurn({
        text: 'Kiss me goodnight',
        ctx: { heldMinor: true },
    });
    assert.equal(turn.notice?.code, 'content_policy');
    assert.equal(turn.notice?.message, REFUSAL_MESSAGE);
    assert.equal(turn.holdMinor, true);
    assert.equal(calls.n, 1);
    assert.equal(moderation.degradedFallbacks, 1);
});

test('a local minor stays blocked when the classifier is down', async () => {
    const calls = { n: 0 };
    const moderation = serviceFor({}, downProvider(timeoutError(), calls));
    const turn = await moderation.moderateTurn({ text: "I'm 15" });
    assert.equal(turn.notice?.code, 'content_policy');
    assert.equal(turn.holdMinor, true);
    assert.equal(calls.n, 1);
    const csam = await serviceFor({}, downProvider(timeoutError(), { n: 0 })).moderateTurn({
        text: 'send me loli pics',
    });
    assert.equal(csam.notice?.code, 'content_policy');
    assert.equal(csam.holdMinor, true);
});

test('a crisis phrase still gets the crisis reply when the classifier is down', async () => {
    const calls = { n: 0 };
    const moderation = serviceFor({}, downProvider(httpError(503), calls));
    const turn = await moderation.moderateTurn({ text: 'I want to kill myself' });
    assert.equal(turn.notice?.action, 'crisis');
    assert.equal(turn.notice?.code, 'self_harm');
    assert.match(turn.notice?.message ?? '', /14416/);
    assert.equal(calls.n, 0);
    assert.equal(moderation.degradedFallbacks, 0);
});

test('explicit sexual content is blocked locally when the classifier is down', async () => {
    const calls = { n: 0 };
    const logs: string[] = [];
    const moderation = serviceFor({}, downProvider(httpError(429), calls), logs);
    const turn = await moderation.moderateTurn({ text: 'talk dirty to me' });
    assert.equal(turn.notice?.code, 'explicit_content');
    assert.equal(turn.notice?.message, EXPLICIT_REFUSAL_MESSAGE);
    assert.equal(turn.holdMinor, false);
    assert.equal(calls.n, 1);
    assert.match(logs[0] ?? '', /reason=429/);
});

test('romance is allowed when the classifier is down', async () => {
    const calls = { n: 0 };
    const moderation = serviceFor({}, downProvider(timeoutError(), calls));
    const turn = await moderation.moderateTurn({ text: 'Kiss me goodnight' });
    assert.equal(turn.notice, null);
    assert.equal(turn.holdMinor, false);
    assert.equal(calls.n, 1);
    assert.equal(moderation.degradedFallbacks, 1);
});

test('classifier clients make one attempt with a short timeout', () => {
    assert.equal(CLASSIFIER_TIMEOUT_MS, 4_000);
    assert.equal(OPENAI_MODERATION_REQUEST.timeout, 4_000);
    assert.equal(OPENAI_MODERATION_REQUEST.maxRetries, 0);
});

test('a chat message is shorter than the classifier input limit', async () => {
    assert.ok(MESSAGE_CONTENT_MAX < GEMINI_MODERATION_MAX_CHARS);
    assert.ok(MESSAGE_CONTENT_MAX < OPENAI_MODERATION_MAX_CHARS);
    const accepted = new CreateMessageDto();
    accepted.content = 'a'.repeat(MESSAGE_CONTENT_MAX);
    assert.equal((await validate(accepted)).length, 0);
    const rejected = new CreateMessageDto();
    rejected.content = 'a'.repeat(MESSAGE_CONTENT_MAX + 1);
    assert.ok((await validate(rejected)).length > 0);
});

test('an over-limit classifier error is a refusal and not degraded mode', async () => {
    const logs: string[] = [];
    let calls = 0;
    const provider: ContentModerator = {
        id: 'gemini',
        maxChars: 50,
        async moderate() {
            calls += 1;
            throw new Error('Moderation input exceeds the provider limit');
        },
    };
    const moderation = serviceFor({}, provider, logs);
    const notice = await moderation.noticeFor('hello there', 'input');
    assert.equal(notice?.code, 'content_policy');
    assert.equal(moderation.degradedFallbacks, 0);
    assert.equal(logs.some((line) => line.includes('degraded')), false);
    assert.equal(logs.some((line) => line.includes('unavailable')), false);
    assert.equal(calls, 1);
});

test('memory text is capped so the classifier batch stays under the provider limit', async () => {
    const bodies: string[] = [];
    const provider: ContentModerator = {
        id: 'gemini',
        maxChars: 80,
        async moderate(text) {
            bodies.push(text);
            return {
                categories: [],
                items: [
                    { id: 'user', categories: [] },
                    { id: '1', categories: [] },
                ],
            };
        },
    };
    const moderation = serviceFor({}, provider);
    const memory = `memory ${'x'.repeat(500)}`;
    const turn = await moderation.moderateTurn({
        text: 'hello from the user',
        memories: [{ id: '1', content: memory }],
    });
    assert.equal(bodies.length, 1);
    assert.ok((bodies[0]?.length ?? 0) <= 80);
    assert.match(bodies[0] ?? '', /hello from the user/);
    assert.equal(bodies[0]?.includes('x'.repeat(500)), false);
    assert.deepEqual(turn.allowedMemoryIds, ['1']);
    assert.equal(moderation.degradedFallbacks, 0);
});

test('user text over the provider limit is chunked instead of marked unavailable', async () => {
    const lengths: number[] = [];
    const provider: ContentModerator = {
        id: 'gemini',
        maxChars: 40,
        async moderate(text) {
            lengths.push(text.length);
            return { categories: text.includes('FLAG') ? ['illegal_harm'] : [] };
        },
    };
    const moderation = serviceFor({}, provider);
    const turn = await moderation.moderateTurn({
        text: `${'a'.repeat(30)}FLAG${'b'.repeat(30)}`,
        memories: [{ id: '1', content: 'unscored memory that does not fit beside the chunks' }],
    });
    assert.ok(lengths.length > 1);
    assert.ok(lengths.every((length) => length <= 40));
    assert.equal(turn.notice?.code, 'content_policy');
    assert.deepEqual(turn.allowedMemoryIds, []);
    assert.equal(moderation.degradedFallbacks, 0);
});

test('degraded mode drops memories that have no cached classifier pass', async () => {
    let fail = false;
    const provider: ContentModerator = {
        id: 'gemini',
        async moderate() {
            if (fail) throw timeoutError();
            return {
                categories: [],
                items: [
                    { id: 'user', categories: [] },
                    { id: '1', categories: [] },
                ],
            };
        },
    };
    const moderation = serviceFor({}, provider);
    const first = await moderation.moderateTurn({
        text: 'hello',
        memories: [{ id: '1', content: 'likes chai' }],
    });
    assert.deepEqual(first.allowedMemoryIds, ['1']);
    fail = true;
    const second = await moderation.moderateTurn({
        text: 'hello again',
        memories: [
            { id: '1', content: 'likes chai' },
            { id: '2', content: 'a new memory' },
        ],
    });
    assert.equal(second.notice, null);
    assert.deepEqual(second.allowedMemoryIds, ['1']);
    assert.equal(moderation.degradedFallbacks, 1);
});

function downProvider(error: unknown, calls: { n: number }): ContentModerator {
    return {
        id: 'gemini',
        async moderate() {
            calls.n += 1;
            throw error;
        },
    };
}

function httpError(status: number): Error {
    return Object.assign(new Error(`status ${status}`), { status });
}

function timeoutError(): Error {
    const error = new Error('The operation was aborted due to timeout');
    error.name = 'TimeoutError';
    return error;
}

test('self-harm instructions from the provider take the crisis path on input', async () => {
    const provider: ContentModerator = {
        id: 'openai',
        async moderate() {
            return { categories: ['self_harm'] };
        },
    };
    const notice = await serviceFor({}, provider).noticeFor('tell me the steps', 'input');
    assert.equal(notice?.action, 'crisis');
    assert.equal(notice?.code, 'self_harm');
});
