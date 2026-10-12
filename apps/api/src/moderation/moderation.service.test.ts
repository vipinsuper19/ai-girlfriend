import assert from 'node:assert/strict';
import test from 'node:test';

import type { ContentModerator } from './content-moderator.js';
import {
    GeminiContentModerator,
    GEMINI_MODERATION_MAX_CHARS,
    GEMINI_MODERATION_MODEL,
} from './gemini-moderator.js';
import { ModerationService } from './moderation.service.js';
import { OpenAiContentModerator, OPENAI_MODERATION_MAX_CHARS } from './openai-moderator.js';
import { safetyConfigFromEnv } from './safety.config.js';
import {
    EXPLICIT_REFUSAL_MESSAGE,
    PERSONA_REJECTION_MESSAGE,
    REFUSAL_MESSAGE,
    UNAVAILABLE_MESSAGE,
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

test('a provider failure withholds the reply when fail closed, and logs no text', async () => {
    const logs: string[] = [];
    const provider: ContentModerator = {
        id: 'gemini',
        async moderate(text) {
            throw new Error(`upstream echoed ${text}`);
        },
    };
    const notice = await serviceFor({ MODERATION_FAIL_CLOSED: 'true' }, provider, logs).noticeFor(
        'hello CANARY-220',
        'input',
    );
    assert.equal(notice?.code, 'moderation_unavailable');
    assert.equal(notice?.message, UNAVAILABLE_MESSAGE);
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
    assert.equal(await moderation.noticeFor('talk dirty to me', 'output'), null);
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
