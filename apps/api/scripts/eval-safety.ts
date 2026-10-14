/**
 * Score the public safety fixtures, plus a held-out file outside this repo.
 * Not part of CI. Requires OPENAI_API_KEY (preferred) or GEMINI_API_KEY.
 *
 *   pnpm eval:safety -- --heldout /absolute/path/outside/the/repo.json
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
    chatTranscriptVerdicts,
    chatTurnVerdict,
    personaVerdict,
} from '../src/moderation/eval-verdict.js';
import { heldoutPathProblem } from '../src/moderation/heldout-path.js';

import { createContentModerator } from '../src/moderation/moderation.factory.js';
import { ModerationService } from '../src/moderation/moderation.service.js';
import { safetyConfigFromEnv } from '../src/moderation/safety.config.js';
import {
    personaMinorAge,
    personaText,
    type PersonaDraft,
    type SafetyCategory,
    type SafetyCode,
} from '../src/moderation/safety-policy.js';
import { UnsafePersonaException } from '../src/moderation/unsafe-persona.exception.js';

type Verdict = SafetyCode | 'allow';

interface RedteamTurn {
    role: 'user' | 'assistant' | 'memory';
    text: string;
}

interface RedteamCase {
    id: string;
    category: string;
    target: 'message' | 'persona';
    turns: RedteamTurn[];
    persona?: PersonaDraft;
    expected_verdict: Verdict;
    acceptable_verdicts?: Verdict[];
    must_include: string[];
    must_not_include: string[];
}

function loadCases(path: string): RedteamCase[] {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { cases?: RedteamCase[] };
    if (!Array.isArray(parsed.cases)) throw new Error(`No cases in ${path}`);
    return parsed.cases;
}

async function verdictFor(
    moderation: ModerationService,
    text: string,
    surface: 'input' | 'persona',
    extra: SafetyCategory[] = [],
): Promise<{ got: Verdict; message: string }> {
    return surface === 'persona'
        ? personaVerdict(moderation, text, extra)
        : chatTurnVerdict(moderation, text);
}

async function evaluate(
    moderation: ModerationService,
    redteamCase: RedteamCase,
): Promise<string[]> {
    if (redteamCase.target === 'persona') {
        const draft = redteamCase.persona;
        if (!draft) return ['missing persona'];
        const extra: SafetyCategory[] = personaMinorAge(draft) ? ['minor'] : [];
        const verdict = await verdictFor(moderation, personaText(draft), 'persona', extra);
        let threw = false;
        try {
            await moderation.assertSafePersona(draft);
        } catch (error) {
            if (!(error instanceof UnsafePersonaException)) throw error;
            threw = true;
        }
        const problems = problemsFor(redteamCase, verdict.got, verdict.message);
        if (threw !== (verdict.got !== 'allow')) {
            problems.push('assertSafePersona did not match the notice');
        }
        return problems;
    }

    const memories = redteamCase.turns.filter((turn) => turn.role === 'memory');
    const users = redteamCase.turns.filter((turn) => turn.role === 'user');
    const problems: string[] = [];
    if (memories.length > 0) {
        for (const turn of memories) {
            const verdict = await verdictFor(moderation, turn.text, 'input');
            problems.push(...problemsFor(redteamCase, verdict.got, verdict.message, 'memory '));
        }
        for (const turn of users) {
            const verdict = await verdictFor(moderation, turn.text, 'input');
            if (verdict.got !== 'allow') problems.push(`follow-up expected allow got ${verdict.got}`);
        }
        return problems;
    }
    // Same path as chat: moderateTurn with priorUserTexts, refused turns dropped.
    const verdicts = await chatTranscriptVerdicts(moderation, users.map((turn) => turn.text));
    for (const [index, verdict] of verdicts.entries()) {
        const last = index === verdicts.length - 1;
        if (!last) {
            if (verdict.got !== 'allow') problems.push(`earlier turn expected allow got ${verdict.got}`);
            continue;
        }
        problems.push(...problemsFor(redteamCase, verdict.got, verdict.message));
    }
    return problems;
}

function problemsFor(
    redteamCase: RedteamCase,
    got: Verdict,
    message: string,
    label = '',
): string[] {
    const accepted = [redteamCase.expected_verdict, ...(redteamCase.acceptable_verdicts ?? [])];
    if (!accepted.includes(got)) {
        return [`${label}expected ${redteamCase.expected_verdict} got ${got}`];
    }
    if (got !== redteamCase.expected_verdict) return [];
    const problems: string[] = [];
    for (const fragment of redteamCase.must_include ?? []) {
        if (!message.includes(fragment)) problems.push(`${label}missing ${JSON.stringify(fragment)}`);
    }
    for (const fragment of redteamCase.must_not_include ?? []) {
        if (message.includes(fragment)) problems.push(`${label}includes ${JSON.stringify(fragment)}`);
    }
    return problems;
}

async function score(moderation: ModerationService, title: string, path: string): Promise<number> {
    const cases = loadCases(path);
    const byCategory = new Map<string, { pass: number; total: number }>();
    let pass = 0;
    const misses: string[] = [];
    for (const redteamCase of cases) {
        const bucket = byCategory.get(redteamCase.category) ?? { pass: 0, total: 0 };
        bucket.total += 1;
        const problems = await evaluate(moderation, redteamCase);
        if (problems.length === 0) {
            pass += 1;
            bucket.pass += 1;
        } else {
            misses.push(`${redteamCase.id} ${problems.join('; ')}`);
        }
        byCategory.set(redteamCase.category, bucket);
    }
    console.log(`\n${title}  ${pass}/${cases.length}`);
    for (const [category, bucket] of byCategory) {
        console.log(`  ${category}  ${bucket.pass}/${bucket.total}`);
    }
    if (misses.length > 0) {
        console.log('  misses:');
        for (const line of misses) console.log(`    ${line}`);
    }
    return cases.length - pass;
}

const hasKey = Boolean(process.env.OPENAI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim());
if (!hasKey) {
    console.error('eval:safety needs OPENAI_API_KEY or GEMINI_API_KEY. It does not run in CI.');
    process.exit(1);
}

const config = safetyConfigFromEnv();
if (config.provider === 'local') {
    console.error('MODERATION_PROVIDER=local skips the real classifier. Unset it to score the fixtures.');
    process.exit(1);
}

const heldout = readHeldoutArg(process.argv.slice(2));
const repoRoot = resolve(import.meta.dirname, '../../..');
const problem = heldoutPathProblem(heldout, repoRoot);
if (problem) {
    console.error(problem);
    process.exit(1);
}

const fixtures = resolve(import.meta.dirname, '../src/moderation/fixtures');
const moderation = new ModerationService(config, createContentModerator(config, process.env), {
    warn() {},
});

console.log(`classifier=${config.provider}`);
const missed = (await score(moderation, 'redteam-cases', resolve(fixtures, 'redteam-cases.json')))
    + (await score(moderation, 'held-out', heldout));
if (missed > 0) process.exit(1);

function readHeldoutArg(argv: readonly string[]): string {
    const index = argv.indexOf('--heldout');
    const value = index >= 0 ? argv[index + 1] : undefined;
    if (!value || value.startsWith('--')) {
        console.error('usage: pnpm eval:safety -- --heldout /absolute/path/outside/the/repo.json');
        process.exit(1);
    }
    return value;
}
