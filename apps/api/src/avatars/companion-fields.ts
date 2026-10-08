type FieldKind = 'string' | 'int' | 'number' | 'json' | 'array';

const APPEARANCE_FIELDS: Record<string, FieldKind> = {
    age: 'int',
    ethnicity: 'string',
    skinTone: 'string',
    hairColor: 'string',
    hairStyle: 'string',
    eyeColor: 'string',
    bodyType: 'string',
    height: 'string',
    clothingStyle: 'string',
    avatarUrl: 'string',
    imagePrompt: 'string',
    metadata: 'json',
};

const PERSONALITY_FIELDS: Record<string, FieldKind> = {
    traits: 'array',
    interests: 'array',
    likes: 'json',
    dislikes: 'json',
    humorLevel: 'int',
    flirtLevel: 'int',
    empathyLevel: 'int',
    romanceLevel: 'int',
    communicationStyle: 'string',
    metadata: 'json',
};

const VOICE_FIELDS: Record<string, FieldKind> = {
    provider: 'string',
    voiceId: 'string',
    language: 'string',
    speed: 'number',
    pitch: 'number',
    settings: 'json',
};

export const COMPANION_TEXT_MAX = 2000;

export type FieldPick = {
    data: Record<string, unknown>;
    problem: string | null;
};

function fits(kind: FieldKind, value: unknown): boolean {
    if (value === null) return kind !== 'array';
    switch (kind) {
        case 'string':
            return typeof value === 'string' && value.length <= COMPANION_TEXT_MAX;
        case 'int':
            return Number.isInteger(value);
        case 'number':
            return typeof value === 'number' && Number.isFinite(value);
        case 'array':
            return Array.isArray(value);
        case 'json':
            return typeof value === 'object';
    }
}

/**
 * The nested blocks arrive as plain objects, so only known columns are copied.
 * Keys such as id or companionId never reach the ORM.
 */
function pick(
    source: Record<string, unknown> | null | undefined,
    fields: Record<string, FieldKind>,
    block: string,
): FieldPick {
    const data: Record<string, unknown> = {};
    if (!source) return { data, problem: null };

    for (const [key, kind] of Object.entries(fields)) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
        const value = source[key];
        if (value === undefined) continue;
        if (!fits(kind, value)) {
            return { data: {}, problem: `${block}.${key} is not valid` };
        }
        data[key] = value;
    }

    return { data, problem: null };
}

export function appearanceFields(source: Record<string, unknown> | null | undefined): FieldPick {
    return pick(source, APPEARANCE_FIELDS, 'appearance');
}

export function personalityFields(source: Record<string, unknown> | null | undefined): FieldPick {
    return pick(source, PERSONALITY_FIELDS, 'personality');
}

export function voiceFields(source: Record<string, unknown> | null | undefined): FieldPick {
    return pick(source, VOICE_FIELDS, 'voice');
}

/** Only a portrait this API stored for this companion may be kept on her appearance. */
export function ownAvatarUrl(
    url: unknown,
    companionId: number,
): string | null {
    if (typeof url !== 'string' || !url) return null;
    const prefix = `/uploads/companions/${companionId}-`;
    if (!url.startsWith(prefix)) return null;
    const name = url.slice('/uploads/companions/'.length);
    return /^[0-9]+-[0-9a-f-]+\.(jpg|jpeg|png|webp)$/i.test(name) ? url : null;
}
