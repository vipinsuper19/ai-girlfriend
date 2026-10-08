export type PromptAppearance = {
    age?: number | null;
    ethnicity?: string | null;
    skinTone?: string | null;
    hairColor?: string | null;
    hairStyle?: string | null;
    eyeColor?: string | null;
    bodyType?: string | null;
    clothingStyle?: string | null;
    metadata?: { style?: unknown } | null;
};

export const IMAGE_PROMPT_MAX = 500;
const ADULT_AGE = 21;

const GENDER_WORD: Record<string, string> = {
    FEMALE: 'woman',
    MALE: 'man',
    OTHER: 'person',
};

/**
 * Builds the provider prompt from her stored look plus the user's request.
 * She is always drawn as an adult, and an under-18 age is refused.
 */
export function companionImagePrompt(
    name: string,
    gender: string | null | undefined,
    appearance: PromptAppearance | null | undefined,
    request: string | null | undefined,
): { prompt: string | null; problem: string | null } {
    const age = appearance?.age;
    if (typeof age === 'number' && age < 18) {
        return { prompt: null, problem: 'Images are only made of adult companions' };
    }

    const who = GENDER_WORD[gender ?? ''] ?? 'person';
    const shownAge = typeof age === 'number' ? Math.max(age, ADULT_AGE) : ADULT_AGE;
    const style = typeof appearance?.metadata?.style === 'string' ? appearance.metadata.style : null;

    const look = [
        appearance?.ethnicity,
        appearance?.skinTone && `${appearance.skinTone} skin`,
        appearance?.hairColor && appearance?.hairStyle
            ? `${appearance.hairColor} ${appearance.hairStyle} hair`
            : appearance?.hairColor
                ? `${appearance.hairColor} hair`
                : appearance?.hairStyle && `${appearance.hairStyle} hair`,
        appearance?.eyeColor && `${appearance.eyeColor} eyes`,
        appearance?.bodyType && `${appearance.bodyType} build`,
        appearance?.clothingStyle && `wearing ${appearance.clothingStyle} clothes`,
    ].filter((part): part is string => Boolean(part && String(part).trim()));

    const scene = request?.trim().slice(0, IMAGE_PROMPT_MAX) || 'a warm, natural portrait';

    const sentences = [
        `${style ?? 'Photorealistic'} image of ${name.trim() || 'her'}, an adult ${who} about ${shownAge} years old.`,
        look.length ? `Appearance: ${look.join(', ')}.` : '',
        `Scene: ${scene}.`,
        'Fully clothed, tasteful, no text, no watermark.',
    ];

    return { prompt: sentences.filter(Boolean).join(' '), problem: null };
}
