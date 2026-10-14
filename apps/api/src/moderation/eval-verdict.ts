import type { ModerationService } from './moderation.service.js';
import {
    priorUserTexts,
    type SafetyCategory,
    type SafetyCode,
    type SafetyLogContext,
    type SafetyNotice,
} from './safety-policy.js';

export type Verdict = SafetyCode | 'allow';

export interface EvalVerdict {
    got: Verdict;
    message: string;
    holdMinor: boolean;
}

function toVerdict(notice: SafetyNotice | null, holdMinor: boolean): EvalVerdict {
    return { got: notice?.code ?? 'allow', message: notice?.message ?? '', holdMinor };
}

/**
 * The chat server's verdict for one user line: the same `moderateTurn` call
 * AiService.guardInput makes. scripts/eval-safety.ts uses this so the eval
 * and the server cannot diverge.
 */
export async function chatTurnVerdict(
    moderation: ModerationService,
    text: string,
    ctx: SafetyLogContext = {},
): Promise<EvalVerdict> {
    const turn = await moderation.moderateTurn({ text, ctx });
    return toVerdict(turn.notice, turn.holdMinor);
}

/** The persona verdict assertSafePersona applies. */
export async function personaVerdict(
    moderation: ModerationService,
    text: string,
    extra: SafetyCategory[] = [],
): Promise<EvalVerdict> {
    const notice = await moderation.noticeFor(text, 'persona', { personaText: text }, extra);
    return toVerdict(notice, false);
}

/**
 * Scores user lines in order the way chat does: each line sees the earlier
 * lines through `priorUserTexts`, which drops refused turns and canned text.
 */
export async function chatTranscriptVerdicts(
    moderation: ModerationService,
    lines: readonly string[],
    ctx: Omit<SafetyLogContext, 'priorTexts'> = {},
): Promise<EvalVerdict[]> {
    const transcript: Array<{ role: string; content: string; metadata?: unknown }> = [];
    const verdicts: EvalVerdict[] = [];
    for (const line of lines) {
        const current = { role: 'USER', content: line } as { role: string; content: string; metadata?: unknown };
        transcript.push(current);
        const priorTexts = priorUserTexts(transcript, current);
        const turn = await moderation.moderateTurn({ text: line, ctx: { ...ctx, priorTexts } });
        if (turn.notice) {
            current.metadata = { safety: turn.notice };
            transcript.push({ role: 'ASSISTANT', content: turn.notice.message });
        }
        verdicts.push(toVerdict(turn.notice, turn.holdMinor));
    }
    return verdicts;
}
