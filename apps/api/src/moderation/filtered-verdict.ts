import { FilteredClassifierError } from './gemini-moderator.js';
import {
    assessLocal,
    hasMinorCue,
    type SafetyCategory,
    type SafetyLogContext,
} from './safety-policy.js';

/**
 * The one verdict for an empty or filtered classifier result. Chat
 * (moderateTurn), noticeFor, personas, and scripts/eval-safety.ts all reach
 * this, so the server and the eval cannot diverge.
 *
 * With a minor signal: `filtered` + `minor`, the hard content_policy block
 * and the minor hold. Otherwise `explicit`, the soft in-character refusal
 * with no hold. Never an allow. A minor signal is Gemini's child-safety block (PROHIBITED_CONTENT), a stored
 * hold, or hasMinorCue matching the input, earlier allowed turns, or the persona.
 */
export function filteredClassifierCategories(
    error: unknown,
    texts: readonly string[],
    ctx: SafetyLogContext,
): SafetyCategory[] {
    const childSafety = error instanceof FilteredClassifierError && error.childSafety;
    const minor =
        childSafety ||
        ctx.heldMinor === true ||
        hasMinorCue(...texts, ...(ctx.priorTexts ?? []), ctx.personaText);
    // Adult filtered text: the soft in-character refusal, no hold. Never allow.
    return minor ? ['filtered', 'minor'] : ['explicit'];
}

/**
 * A classifier minor_present with no minor_role counts only when the text or
 * earlier allowed turns carry an actual age, school, or child cue.
 */
export function resolveMinorUnconfirmed(
    categories: readonly SafetyCategory[],
    texts: readonly string[],
    ctx: Pick<SafetyLogContext, 'priorTexts'> = {},
): SafetyCategory[] {
    if (!categories.includes('minor_unconfirmed')) return [...categories];
    const rest = categories.filter((category) => category !== 'minor_unconfirmed');
    if (hasMinorCue(...texts, ...(ctx.priorTexts ?? []))) {
        return rest.includes('minor') ? rest : [...rest, 'minor'];
    }
    return rest;
}

const FOLLOW_UP_OPENER =
    /^\s*(?:ok(?:ay)?|k|sorry|soz|my\s+bad|never\s*mind|nvm|forget\s+(?:it|that|about\s+it|what\s+i\s+said)|fine|alright|all\s+right|anyway|chalo|theek\s+hai|thik\s+hai|accha|achha|haan|leave\s+it|no\s+worries|oops)\b/i;
const INSTRUCTION_WORDS =
    /\b(?:instructions?|prompts?|system|developer|mode|dan|jailbreak\w*|unfiltered|uncensored|unrestricted|rules|restrictions?|filters?|polic(?:y|ies)|override|bypass|pretend|role|act\s+as|you\s+are\s+now|from\s+now\s+on|reveal|repeat)\b/i;

/**
 * A short "ok sorry, how was your day?" after a refused request is not a
 * prompt injection. Drops a classifier-only `jailbreak` from such a
 * follow-up when the local injection rules do not match and the text names
 * no instruction, prompt, mode, or rule. Every other category is kept.
 */
export function withoutFollowUpInjection(
    categories: readonly SafetyCategory[],
    text: string,
): SafetyCategory[] {
    if (!categories.includes('jailbreak')) return [...categories];
    const trimmed = text.trim();
    if (trimmed.length > 140) return [...categories];
    if (!FOLLOW_UP_OPENER.test(trimmed) || INSTRUCTION_WORDS.test(trimmed)) return [...categories];
    if (assessLocal(trimmed, 'input').includes('jailbreak')) return [...categories];
    return categories.filter((category) => category !== 'jailbreak');
}
