import { FilteredClassifierError } from './gemini-moderator.js';
import { hasMinorCue, type SafetyCategory, type SafetyLogContext } from './safety-policy.js';

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
