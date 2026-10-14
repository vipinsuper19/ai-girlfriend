/**
 * Tech Lead regression cases, scored the way CI scores chat.
 *
 * The provider is the JSON-classifier stand-in from ai.service.safety.test.ts
 * (id `gemini`, no API key). A lone user turn is sent to that stand-in unless
 * a local crisis phrase already decided the turn. `expected_verdict` is the
 * notice code, or `allow` when the notice is null.
 *
 * HO-MIN-026 asks a minor flag to survive six filler messages and a new chat
 * for the same user. The in-chat line is scored with those earlier lines as
 * priorTexts. The new chat is scored with an empty history and heldMinor set
 * from the flag turn, which is what AiService stores on the user.
 *
 * Cases that still miss are expected failures. The test fails if one of them
 * starts passing, so the marker is removed once the gap is actually closed.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import type { ContentModerator } from './content-moderator.js';
import { ModerationService } from './moderation.service.js';
import { helplinesFromEnv, safetyConfigFromEnv } from './safety.config.js';
import {
    personaMinorAge,
    personaText,
    type PersonaDraft,
    type SafetyCategory,
    type SafetyCode,
    type SafetyLogContext,
} from './safety-policy.js';
import { UnsafePersonaException } from './unsafe-persona.exception.js';

type Verdict = SafetyCode | 'allow';

interface RedteamTurn {
    role: 'user' | 'assistant' | 'memory';
    text: string;
}

interface RedteamCase {
    id: string;
    category: string;
    language: string;
    target: 'message' | 'persona';
    turns: RedteamTurn[];
    persona?: PersonaDraft;
    expected_verdict: Verdict;
    acceptable_verdicts?: Verdict[];
    must_include: string[];
    must_not_include: string[];
    priority: 'P0' | 'P1' | 'P2';
    note?: string;
    persistence?: 'minor_user';
}

interface Evaluation {
    got: Verdict;
    problems: string[];
}

interface Gap {
    reason: string;
    /** Verdict the local layer returns today. Defaults to allow. */
    got?: Verdict;
}

const VERDICTS = new Set<Verdict>([
    'allow',
    'content_policy',
    'explicit_content',
    'self_harm',
    'moderation_unavailable',
]);

const CATEGORIES = new Set([
    'romance_allowed',
    'explicit_soft',
    'minors_hard',
    'persona_field',
    'self_harm_crisis',
    'self_harm_false_positive',
    'hate_harassment',
    'illegal_harm',
    'prompt_injection',
]);

/**
 * Misses still allowed to fail against the CI classifier stand-in. A passing
 * case is a hard regression check and is not listed here.
 */
const KNOWN_GAPS: Record<string, Gap> = {
    'HO-MIN-025': {
        reason: '"age: 15" is not a first-person age, and the CI classifier stand-in returns no category.',
    },
    'HO-SH-009': {
        reason: '"disappear forever" is outside the crisis phrases, and the CI classifier stand-in returns no category.',
    },
};

const cases = loadCases();

interface LocalRun {
    moderation: ModerationService;
    providerId: string;
}

/** CI stand-in for the JSON classifier. The local pre-filter does not score these. */
const classifier: ContentModerator = {
    id: 'gemini',
    async moderate(text) {
        if (/\bbomb\b/i.test(text)) return { categories: ['illegal_harm'] };
        if (/\bfuck\b/i.test(text)) return { categories: ['explicit'] };
        return { categories: [] };
    },
};

function localService(): LocalRun {
    return {
        moderation: new ModerationService(
            safetyConfigFromEnv({ MODERATION_PROVIDER: 'local' }),
            classifier,
            { warn() {} },
        ),
        providerId: classifier.id,
    };
}

it('tech lead regression fixture has 21 cases', () => {
    assert.equal(cases.length, 21);
    assert.equal(localService().providerId, 'gemini');
    assert.equal(
        safetyConfigFromEnv({ MODERATION_PROVIDER: 'local' }).provider,
        'local',
    );
    const helplines = helplinesFromEnv({});
    assert.equal(helplines[0]?.name, 'Tele-MANAS');
    assert.equal(helplines[0]?.contact, '14416');

    const ids = new Set<string>();
    let romance = 0;
    for (const redteamCase of cases) {
        assert.equal(ids.has(redteamCase.id), false, `duplicate ${redteamCase.id}`);
        assert.ok(redteamCase.id.startsWith('HO-'), redteamCase.id);
        ids.add(redteamCase.id);
        assert.ok(CATEGORIES.has(redteamCase.category), redteamCase.id);
        assert.ok(
            redteamCase.priority === 'P0' ||
                redteamCase.priority === 'P1' ||
                redteamCase.priority === 'P2',
            redteamCase.id,
        );
        assert.ok(VERDICTS.has(redteamCase.expected_verdict), redteamCase.id);
        assert.ok(Array.isArray(redteamCase.must_include), redteamCase.id);
        assert.ok(Array.isArray(redteamCase.must_not_include), redteamCase.id);
        if (redteamCase.category === 'romance_allowed') romance += 1;
        if (redteamCase.target === 'persona') {
            assert.ok(redteamCase.persona, redteamCase.id);
        } else {
            assert.equal(redteamCase.target, 'message', redteamCase.id);
            assert.ok(
                redteamCase.turns.some(
                    (turn) => turn.role === 'user' || turn.role === 'memory',
                ),
                redteamCase.id,
            );
        }
    }
    assert.equal(romance, 5);
    assert.equal(Object.keys(KNOWN_GAPS).length, 2);
    for (const id of Object.keys(KNOWN_GAPS)) {
        assert.ok(ids.has(id), `${id} is not in the fixture`);
    }
    for (const redteamCase of cases) {
        if (redteamCase.category === 'romance_allowed') {
            assert.equal(KNOWN_GAPS[redteamCase.id], undefined, redteamCase.id);
        }
    }
});

const byCategory = new Map<string, RedteamCase[]>();
for (const redteamCase of cases) {
    const group = byCategory.get(redteamCase.category) ?? [];
    group.push(redteamCase);
    byCategory.set(redteamCase.category, group);
}

for (const [category, group] of byCategory) {
    describe(`tech lead ${category}`, () => {
        for (const redteamCase of group) {
            const gap = KNOWN_GAPS[redteamCase.id];
            if (gap) {
                it(`${redteamCase.id} ${redteamCase.priority} expected failure: ${gap.reason}`, async () => {
                    const evaluation = await evaluate(redteamCase);
                    const recorded = gap.got ?? 'allow';
                    assert.ok(
                        evaluation.problems.length > 0,
                        `${redteamCase.id} now passes the local safety layer. Remove it from KNOWN_GAPS. Previous gap: ${gap.reason}`,
                    );
                    assert.equal(
                        evaluation.got,
                        recorded,
                        `${redteamCase.id} failed differently (got ${evaluation.got}: ${evaluation.problems.join('; ')}). Recorded gap: ${gap.reason}`,
                    );
                });
                continue;
            }
            it(`${redteamCase.id} ${redteamCase.priority}`, async () => {
                const evaluation = await evaluate(redteamCase);
                assert.deepEqual(evaluation.problems, []);
            });
        }
    });
}

function loadCases(): RedteamCase[] {
    const parsed: unknown = JSON.parse(
        readFileSync(
            new URL('./fixtures/techlead-regression-cases.json', import.meta.url),
            'utf8',
        ),
    );
    assert.ok(parsed && typeof parsed === 'object');
    const suite = parsed as { version?: unknown; cases?: unknown };
    assert.equal(suite.version, 1);
    assert.ok(Array.isArray(suite.cases));
    return suite.cases as RedteamCase[];
}

async function evaluate(redteamCase: RedteamCase): Promise<Evaluation> {
    const run = localService();
    if (redteamCase.persistence === 'minor_user') {
        return evaluateMinorPersistence(run, redteamCase);
    }
    if (redteamCase.target === 'persona') {
        assert.ok(redteamCase.persona, redteamCase.id);
        const verdict = await personaVerdict(run, redteamCase.persona);
        return {
            got: verdict.got,
            problems: problemsForVerdict(redteamCase, verdict.got, verdict.message),
        };
    }

    const memories = redteamCase.turns.filter((turn) => turn.role === 'memory');
    const users = redteamCase.turns.filter((turn) => turn.role === 'user');
    const problems: string[] = [];

    if (memories.length > 0) {
        let got: Verdict = 'allow';
        for (const turn of memories) {
            const verdict = await inputVerdict(run, turn.text);
            got = verdict.got;
            problems.push(
                ...problemsForVerdict(
                    redteamCase,
                    verdict.got,
                    verdict.message,
                    'memory ',
                ),
            );
        }
        for (const turn of users) {
            const verdict = await inputVerdict(run, turn.text);
            if (verdict.got !== 'allow') {
                problems.push(`follow-up expected allow got ${verdict.got}`);
            }
            problems.push(
                ...forbiddenFragments(redteamCase, verdict.message, 'follow-up '),
            );
        }
        return { got, problems };
    }

    assert.ok(users.length > 0, redteamCase.id);
    let got: Verdict = 'allow';
    for (let index = 0; index < users.length; index += 1) {
        const turn = users[index];
        assert.ok(turn);
        const verdict = await inputVerdict(run, turn.text);
        const last = index === users.length - 1;
        if (!last) {
            if (verdict.got !== 'allow') {
                problems.push(`earlier turn expected allow got ${verdict.got}`);
            }
            problems.push(
                ...forbiddenFragments(redteamCase, verdict.message, 'earlier turn '),
            );
            continue;
        }
        got = verdict.got;
        problems.push(...problemsForVerdict(redteamCase, verdict.got, verdict.message));
    }
    return { got, problems };
}

async function inputVerdict(
    run: LocalRun,
    text: string,
    ctx: SafetyLogContext = {},
): Promise<{ got: Verdict; message: string; holdMinor: boolean }> {
    const turn = await run.moderation.moderateTurn({ text, ctx });
    return {
        got: turn.notice?.code ?? 'allow',
        message: turn.notice?.message ?? '',
        holdMinor: turn.holdMinor,
    };
}

/**
 * The flag turn is scored on its own. The benign last line is scored with the
 * flag and the six fillers as prior text, then again in a new conversation
 * whose only carry-over is the hold the flag turn reported.
 */
async function evaluateMinorPersistence(
    run: LocalRun,
    redteamCase: RedteamCase,
): Promise<Evaluation> {
    const users = redteamCase.turns.filter((turn) => turn.role === 'user');
    const flag = users[0];
    const current = users[users.length - 1];
    const fillers = users.slice(1, -1);
    assert.ok(flag && current && fillers.length >= 6, redteamCase.id);
    const prior = users.slice(0, -1).map((turn) => turn.text);

    const seed = await inputVerdict(run, flag.text, { userId: 42, conversationId: 1 });
    const problems: string[] = [];
    if (seed.got !== 'content_policy') {
        problems.push(`seed expected content_policy got ${seed.got}`);
    }
    const inChat = await inputVerdict(run, current.text, {
        userId: 42,
        conversationId: 1,
        priorTexts: prior,
    });
    const fresh = await inputVerdict(run, current.text, {
        userId: 42,
        conversationId: 2,
        priorTexts: [],
        heldMinor: seed.holdMinor,
    });
    if (inChat.got !== redteamCase.expected_verdict) {
        problems.push(
            `in-chat after ${fillers.length} fillers expected ${redteamCase.expected_verdict} got ${inChat.got}`,
        );
    } else {
        problems.push(...substringProblems(redteamCase, inChat.message));
    }
    if (fresh.got !== redteamCase.expected_verdict) {
        problems.push(`new chat expected ${redteamCase.expected_verdict} got ${fresh.got}`);
    }
    return { got: inChat.got, problems };
}

async function personaVerdict(
    run: LocalRun,
    draft: PersonaDraft,
): Promise<{ got: Verdict; message: string }> {
    const extra: SafetyCategory[] = personaMinorAge(draft) ? ['minor'] : [];
    const notice = await run.moderation.noticeFor(personaText(draft), 'persona', {}, extra);
    let threw = false;
    try {
        await run.moderation.assertSafePersona(draft);
    } catch (error) {
        if (!(error instanceof UnsafePersonaException)) throw error;
        threw = true;
    }
    const got: Verdict = notice?.code ?? 'allow';
    assert.equal(
        threw,
        got !== 'allow',
        'assertSafePersona throws only when the persona notice is non-null',
    );
    return { got, message: notice?.message ?? '' };
}

function problemsForVerdict(
    redteamCase: RedteamCase,
    got: Verdict,
    message: string,
    label = '',
): string[] {
    const accepted = [
        redteamCase.expected_verdict,
        ...(redteamCase.acceptable_verdicts ?? []),
    ];
    if (!accepted.includes(got)) {
        return [`${label}expected ${redteamCase.expected_verdict} got ${got}`];
    }
    if (got === redteamCase.expected_verdict) {
        return substringProblems(redteamCase, message);
    }
    if (got === 'self_harm') {
        const problems: string[] = [];
        if (!message.includes('14416')) problems.push(`${label}missing 14416`);
        if (!message.includes('Tele-MANAS')) problems.push(`${label}missing Tele-MANAS`);
        return problems;
    }
    return [];
}

function substringProblems(redteamCase: RedteamCase, message: string): string[] {
    const problems: string[] = [];
    for (const fragment of redteamCase.must_include) {
        if (!message.includes(fragment)) problems.push(`missing ${JSON.stringify(fragment)}`);
    }
    for (const fragment of redteamCase.must_not_include) {
        if (message.includes(fragment)) problems.push(`includes ${JSON.stringify(fragment)}`);
    }
    return problems;
}

function forbiddenFragments(
    redteamCase: RedteamCase,
    message: string,
    label: string,
): string[] {
    const problems: string[] = [];
    for (const fragment of redteamCase.must_not_include) {
        if (message.includes(fragment)) {
            problems.push(`${label}includes ${JSON.stringify(fragment)}`);
        }
    }
    return problems;
}
