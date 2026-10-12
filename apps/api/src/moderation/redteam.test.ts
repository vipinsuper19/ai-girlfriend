/**
 * Data-driven safety red team for the local moderation layer.
 *
 * Each fixture case is run through ModerationService.noticeFor (messages and
 * stored memory) or assertSafePersona (companion drafts) with the local
 * provider and the default helplines. `expected_verdict` is the notice code,
 * or `allow` when the notice is null. On a multi-turn chat case it applies to
 * the final user turn; earlier user turns must stay allowed. A `memory` turn
 * is moderated on its own, before it could be copied into the prompt.
 *
 * CI checks the narrow local pre-filter: romance must stay allowed.
 * `pnpm eval:safety -- --heldout /path` scores this public suite plus a
 * held-out file that lives outside the repo. That file is not part of CI.
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
}

interface Evaluation {
    /** Verdict of the text the expected verdict applies to. */
    got: Verdict;
    problems: string[];
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
 * Local misses that are still allowed to fail. Empty: the 50 gaps shipped
 * with this suite now pass, including every former P0. Add a marker only when
 * a case is intentionally still out of reach of the regex pre-filter.
 */
const KNOWN_GAPS: Record<string, string> = {};

const cases = loadCases();

interface LocalRun {
    moderation: ModerationService;
    providerId: string;
    remoteCalls: () => number;
}

function localService(): LocalRun {
    let remoteCalls = 0;
    const provider: ContentModerator = {
        id: 'local',
        async moderate() {
            remoteCalls += 1;
            return { categories: [] };
        },
    };
    return {
        moderation: new ModerationService(
            safetyConfigFromEnv({ MODERATION_PROVIDER: 'local' }),
            provider,
            { warn() {} },
        ),
        providerId: provider.id,
        remoteCalls: () => remoteCalls,
    };
}

it('redteam fixture has 188 cases and every recorded gap is one of them', () => {
    assert.equal(cases.length, 188);
    assert.equal(localService().providerId, 'local');
    assert.equal(
        safetyConfigFromEnv({ MODERATION_PROVIDER: 'local' }).provider,
        'local',
    );
    const helplines = helplinesFromEnv({});
    assert.equal(helplines[0]?.name, 'Tele-MANAS');
    assert.equal(helplines[0]?.contact, '14416');

    const ids = new Set<string>();
    for (const redteamCase of cases) {
        assert.equal(ids.has(redteamCase.id), false, `duplicate ${redteamCase.id}`);
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
    for (const id of Object.keys(KNOWN_GAPS)) {
        assert.ok(ids.has(id), `${id} is not in the fixture`);
    }
    for (const redteamCase of cases) {
        if (redteamCase.category === 'romance_allowed') {
            assert.equal(KNOWN_GAPS[redteamCase.id], undefined, redteamCase.id);
        }
    }
    assert.equal(Object.keys(KNOWN_GAPS).length, 0);
});

describe('romance_allowed stays clear of the local pre-filter', () => {
    for (const redteamCase of cases.filter((item) => item.category === 'romance_allowed')) {
        it(`${redteamCase.id} ${redteamCase.priority}`, async () => {
            const evaluation = await evaluate(redteamCase);
            assert.deepEqual(evaluation.problems, []);
        });
    }
});

function loadCases(): RedteamCase[] {
    const parsed: unknown = JSON.parse(
        readFileSync(new URL('./fixtures/redteam-cases.json', import.meta.url), 'utf8'),
    );
    assert.ok(parsed && typeof parsed === 'object');
    const suite = parsed as { version?: unknown; cases?: unknown };
    assert.equal(suite.version, 1);
    assert.ok(Array.isArray(suite.cases));
    return suite.cases as RedteamCase[];
}

async function evaluate(redteamCase: RedteamCase): Promise<Evaluation> {
    const run = localService();
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
): Promise<{ got: Verdict; message: string }> {
    const before = run.remoteCalls();
    const notice = await run.moderation.noticeFor(text, 'input');
    assert.equal(run.remoteCalls(), before, 'local provider must not call a remote moderator');
    return { got: notice?.code ?? 'allow', message: notice?.message ?? '' };
}

async function personaVerdict(
    run: LocalRun,
    draft: PersonaDraft,
): Promise<{ got: Verdict; message: string }> {
    const before = run.remoteCalls();
    const extra: SafetyCategory[] = personaMinorAge(draft) ? ['minor'] : [];
    const notice = await run.moderation.noticeFor(personaText(draft), 'persona', {}, extra);
    let threw = false;
    try {
        await run.moderation.assertSafePersona(draft);
    } catch (error) {
        if (!(error instanceof UnsafePersonaException)) throw error;
        threw = true;
    }
    assert.equal(run.remoteCalls(), before, 'local provider must not call a remote moderator');
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
    // Context-dependent alternative, currently crisis resources on P2 fiction/research lines.
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
