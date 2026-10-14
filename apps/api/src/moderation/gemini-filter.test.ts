import assert from 'node:assert/strict';
import test from 'node:test';

import { ModerationService } from './moderation.service.js';
import {
    FilteredClassifierError,
    GeminiContentModerator,
    GEMINI_MODERATION_MODEL,
    geminiResponseBlocked,
    type GeminiModerationResponse,
} from './gemini-moderator.js';
import { safetyConfigFromEnv } from './safety.config.js';
import { REFUSAL_MESSAGE } from './safety-policy.js';

const API_KEY = 'AIzaSyCANARYKEY1234567890';
const ALLOW_JSON =
    '{"minor_present":false,"minor_sexual":false,"self_harm_risk":"none","explicit":false,"hate":false,"injection":false,"illegal":false,"reason":"ok"}';

function response(body: GeminiModerationResponse): GeminiModerationResponse {
    return body;
}

test('every Gemini filter shape is a block and a normal stop is not', () => {
    const blocked: GeminiModerationResponse[] = [
        response({ text: '', candidates: [{ finishReason: 'STOP' }] }),
        response({ text: '   ', candidates: [{ finishReason: 'STOP' }] }),
        response({ text: undefined, candidates: [{ finishReason: 'STOP' }] }),
        response({ candidates: [] }),
        response({}),
        response({
            text: ALLOW_JSON,
            candidates: [{ finishReason: 'SAFETY' }],
        }),
        response({
            text: 'I cannot classify that',
            candidates: [{ finishReason: 'PROHIBITED_CONTENT' }],
        }),
        response({
            text: ALLOW_JSON,
            candidates: [{ finishReason: 'BLOCKLIST' }],
        }),
        response({
            text: ALLOW_JSON,
            candidates: [{ finishReason: 'SPII' }],
        }),
        response({
            promptFeedback: { blockReason: 'SAFETY' },
            candidates: [],
        }),
        response({
            text: ALLOW_JSON,
            candidates: [{ finishReason: 'STOP' }],
            promptFeedback: { blockReason: 'BLOCKLIST' },
        }),
        response({
            text: ALLOW_JSON,
            candidates: [{ finishReason: 'STOP' }],
            promptFeedback: { blockReason: 'PROHIBITED_CONTENT' },
        }),
    ];
    for (const [index, body] of blocked.entries()) {
        assert.equal(geminiResponseBlocked(body), true, `shape ${index}`);
    }

    assert.equal(
        geminiResponseBlocked({
            text: ALLOW_JSON,
            candidates: [{ finishReason: 'STOP' }],
        }),
        false,
    );
    assert.equal(
        geminiResponseBlocked({
            text: ALLOW_JSON,
            candidates: [{ finishReason: 'MAX_TOKENS' }],
        }),
        false,
    );
    assert.equal(
        geminiResponseBlocked({
            text: ALLOW_JSON,
            candidates: [{ finishReason: 'STOP' }],
            promptFeedback: { blockReason: 'BLOCKED_REASON_UNSPECIFIED' },
        }),
        false,
    );
});

test('filtered Gemini bodies block end to end and never fall back to allow', async () => {
    const shapes: unknown[] = [
        {
            candidates: [
                {
                    content: { parts: [{ text: '' }], role: 'model' },
                    finishReason: 'STOP',
                },
            ],
        },
        {
            candidates: [
                {
                    content: { parts: [], role: 'model' },
                    finishReason: 'STOP',
                },
            ],
        },
        { candidates: [] },
        {},
        {
            candidates: [
                {
                    content: { parts: [{ text: ALLOW_JSON }], role: 'model' },
                    finishReason: 'SAFETY',
                },
            ],
        },
        {
            candidates: [
                {
                    content: { parts: [{ text: 'blocked' }], role: 'model' },
                    finishReason: 'PROHIBITED_CONTENT',
                },
            ],
        },
        {
            candidates: [
                {
                    content: { parts: [{ text: ALLOW_JSON }], role: 'model' },
                    finishReason: 'BLOCKLIST',
                },
            ],
        },
        {
            candidates: [
                {
                    content: { parts: [{ text: ALLOW_JSON }], role: 'model' },
                    finishReason: 'SPII',
                },
            ],
        },
        { promptFeedback: { blockReason: 'SAFETY' } },
        {
            promptFeedback: { blockReason: 'BLOCKLIST' },
            candidates: [
                {
                    content: { parts: [{ text: ALLOW_JSON }], role: 'model' },
                    finishReason: 'STOP',
                },
            ],
        },
    ];

    const original = globalThis.fetch;
    try {
        for (const [index, shape] of shapes.entries()) {
            globalThis.fetch = (async () =>
                new Response(JSON.stringify(shape), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                })) as typeof fetch;
            const moderator = new GeminiContentModerator(API_KEY, GEMINI_MODERATION_MODEL);
            await assert.rejects(
                () => moderator.moderate('hello there'),
                (error: unknown) => error instanceof FilteredClassifierError,
                `moderate shape ${index}`,
            );
            const logs: string[] = [];
            const moderation = new ModerationService(
                safetyConfigFromEnv({ MODERATION_PROVIDER: 'gemini' }),
                moderator,
                { warn(message) { logs.push(message); } },
            );
            const turn = await moderation.moderateTurn({ text: 'Kiss me goodnight' });
            assert.equal(turn.notice?.code, 'content_policy', `turn shape ${index}`);
            assert.equal(turn.notice?.message, REFUSAL_MESSAGE, `turn shape ${index}`);
            // PROHIBITED_CONTENT is Gemini's child-safety block, so it sets the hold.
            assert.equal(
                turn.holdMinor,
                JSON.stringify(shape).includes('PROHIBITED_CONTENT'),
                `turn shape ${index}`,
            );
            assert.equal(moderation.degradedFallbacks, 0, `degraded shape ${index}`);
            assert.equal(
                logs.some((line) => line.includes('moderation.degraded')),
                false,
                `log shape ${index}`,
            );

            const minor = await moderation.moderateTurn({ text: 'class 9' });
            assert.equal(minor.notice?.code, 'content_policy', `minor shape ${index}`);
            assert.equal(minor.holdMinor, true, `minor shape ${index}`);
            assert.equal(moderation.degradedFallbacks, 0, `minor degraded ${index}`);

            const noticed = await moderation.noticeFor('hello there', 'input');
            assert.equal(noticed?.code, 'content_policy', `notice shape ${index}`);
            const output = await moderation.noticeFor('hello there', 'output');
            assert.equal(output?.code, 'content_policy', `output shape ${index}`);
        }
    } finally {
        globalThis.fetch = original;
    }
});

test('a normal Gemini JSON body is still an allow', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
        new Response(
            JSON.stringify({
                candidates: [
                    {
                        content: { parts: [{ text: ALLOW_JSON }], role: 'model' },
                        finishReason: 'STOP',
                    },
                ],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
        )) as typeof fetch;
    try {
        const moderator = new GeminiContentModerator(API_KEY, GEMINI_MODERATION_MODEL);
        const scored = await moderator.moderate('Kiss me goodnight');
        assert.deepEqual(scored.categories, []);
        const moderation = new ModerationService(
            safetyConfigFromEnv({ MODERATION_PROVIDER: 'gemini' }),
            moderator,
        );
        const turn = await moderation.moderateTurn({ text: 'Kiss me goodnight' });
        assert.equal(turn.notice, null);
        assert.equal(moderation.degradedFallbacks, 0);
    } finally {
        globalThis.fetch = original;
    }
});
