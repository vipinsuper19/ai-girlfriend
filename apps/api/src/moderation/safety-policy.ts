export type SafetyCategory =
    | 'sexual_minors'
    | 'minor'
    | 'self_harm'
    | 'illegal_harm'
    | 'jailbreak';

export type ModerationSurface = 'input' | 'output' | 'persona';

export type SafetyCode =
    | 'content_policy'
    | 'self_harm'
    | 'moderation_unavailable';

export interface Helpline {
    name: string;
    contact: string;
    region: string;
    detail: string;
}

/**
 * Shape the Android client can read on a chat response or a stored message.
 * `message` is also the assistant text, so current builds render it as a bubble.
 */
export interface SafetyNotice {
    action: 'refuse' | 'crisis';
    code: SafetyCode;
    message: string;
    helplines?: Helpline[];
}

export interface SafetyLogContext {
    userId?: string | number;
    conversationId?: string | number;
}

export interface PersonaDraft {
    name?: string | null;
    systemPrompt?: string | null;
    greeting?: string | null;
    personality?: {
        traits?: unknown;
        interests?: unknown;
        likes?: unknown;
        dislikes?: unknown;
        communicationStyle?: unknown;
        metadata?: unknown;
    } | null;
    appearance?: {
        age?: unknown;
        imagePrompt?: unknown;
    } | null;
}

export const REFUSAL_MESSAGE =
    "I can't help with that. Let's keep things kind and safe — I'm here if you want to talk about something else.";

export const UNAVAILABLE_MESSAGE =
    "I can't reply just now. Please try again in a moment.";

export const PERSONA_REJECTION_MESSAGE =
    "That companion description isn't allowed. Keep the persona an adult, and leave out harmful, illegal, or sexual content involving minors.";

const NOTICE_CODES = new Set<SafetyCode>([
    'content_policy',
    'self_harm',
    'moderation_unavailable',
]);

export function crisisMessage(helplines: Helpline[]): string {
    const lines = helplines.map(
        (line) => `${line.name} (${line.region}): ${line.contact} — ${line.detail}`,
    );
    return [
        "I'm really glad you told me. You matter, and you don't have to handle this alone.",
        "I'm a companion, not a crisis service. If you're in immediate danger, contact your local emergency number.",
        ...lines,
    ].join('\n');
}

export function unavailableNotice(): SafetyNotice {
    return {
        action: 'refuse',
        code: 'moderation_unavailable',
        message: UNAVAILABLE_MESSAGE,
    };
}

/**
 * Input that signals the user is at risk becomes a crisis reply.
 * The same categories on model output or a persona are a refusal.
 */
export function decideSafety(
    categories: SafetyCategory[],
    surface: ModerationSurface,
    helplines: Helpline[],
): SafetyNotice | null {
    const unique = [...new Set(categories)];
    if (unique.length === 0) return null;
    if (surface === 'input' && unique.includes('self_harm')) {
        return {
            action: 'crisis',
            code: 'self_harm',
            message: crisisMessage(helplines),
            helplines,
        };
    }
    return {
        action: 'refuse',
        code: 'content_policy',
        message: REFUSAL_MESSAGE,
    };
}

export function safetyNoticeOf(
    message: { metadata?: unknown } | null | undefined,
): SafetyNotice | null {
    const metadata = message?.metadata;
    if (!metadata || typeof metadata !== 'object') return null;
    const safety = (metadata as { safety?: unknown }).safety;
    if (!safety || typeof safety !== 'object') return null;
    const notice = safety as Partial<SafetyNotice>;
    if (notice.action !== 'refuse' && notice.action !== 'crisis') return null;
    if (typeof notice.code !== 'string' || !NOTICE_CODES.has(notice.code)) {
        return null;
    }
    if (typeof notice.message !== 'string' || !notice.message.trim()) return null;
    return {
        action: notice.action,
        code: notice.code,
        message: notice.message,
        ...(notice.helplines ? { helplines: notice.helplines } : {}),
    };
}

export function personaMinorAge(draft: PersonaDraft): boolean {
    const age = draft.appearance?.age;
    return typeof age === 'number' && Number.isFinite(age) && age < 18;
}

export function personaText(draft: PersonaDraft): string {
    return [
        draft.name,
        draft.systemPrompt,
        draft.greeting,
        draft.personality?.communicationStyle,
        draft.personality?.traits,
        draft.personality?.interests,
        draft.personality?.likes,
        draft.personality?.dislikes,
        draft.personality?.metadata,
        draft.appearance?.imagePrompt,
    ]
        .map(textOf)
        .filter((part) => part.trim().length > 0)
        .join('\n');
}

function textOf(value: unknown): string {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join('\n');
    if (value && typeof value === 'object') {
        return Object.values(value as Record<string, unknown>)
            .map(textOf)
            .filter(Boolean)
            .join('\n');
    }
    return '';
}

type Rule = {
    category: SafetyCategory;
    pattern: RegExp;
    surfaces: ReadonlySet<ModerationSurface>;
};

const ALL: ReadonlySet<ModerationSurface> = new Set(['input', 'output', 'persona']);
const INPUT_AND_PERSONA: ReadonlySet<ModerationSurface> = new Set(['input', 'persona']);
const OUTPUT_ONLY: ReadonlySet<ModerationSurface> = new Set(['output']);

const RULES: Rule[] = [
    {
        category: 'sexual_minors',
        pattern: /\b(?:lolita|lolicon|loli|shota|shotacon|jailbait|csam)\b/i,
        surfaces: ALL,
    },
    {
        category: 'sexual_minors',
        pattern: /\bchild(?:ren|'s)?\s+porn(?:ography)?\b/i,
        surfaces: ALL,
    },
    {
        category: 'sexual_minors',
        pattern:
            /\b(?:underage|under-age|pre-?teen|minor|minors|(?:a|the)\s+child(?:ren)?)\b[\s\S]{0,48}\b(?:sex|sexual|nude|naked|porn|nsfw|erotic)\b/i,
        surfaces: ALL,
    },
    {
        category: 'sexual_minors',
        pattern:
            /\b(?:sex|sexual|nude|naked|porn|nsfw|erotic)\b[\s\S]{0,48}\b(?:underage|under-age|pre-?teen|minor|minors|(?:a|the)\s+child(?:ren)?)\b/i,
        surfaces: ALL,
    },
    {
        category: 'sexual_minors',
        pattern:
            /\b(?:1[0-7]|[1-9])\s*(?:years?\s*old|yo)\b[\s\S]{0,48}\b(?:sex|sexual|nude|naked|porn|nsfw|erotic|fuck)\b/i,
        surfaces: ALL,
    },
    {
        category: 'sexual_minors',
        pattern:
            /\b(?:sex|sexual|nude|naked|porn|nsfw|erotic|fuck)\b[\s\S]{0,48}\b(?:1[0-7]|[1-9])\s*(?:years?\s*old|yo)\b/i,
        surfaces: ALL,
    },
    {
        category: 'minor',
        pattern:
            /\b(?:you(?:'re| are)|i(?:'m| am)|she(?:'s| is)|he(?:'s| is))\s+(?:only\s+|just\s+)?(?:1[0-7]|[1-9])\s*(?:years?\s*old|yo)\b/i,
        surfaces: INPUT_AND_PERSONA,
    },
    {
        category: 'minor',
        pattern:
            /\b(?:pretend|role-?play|act like)\b[\s\S]{0,80}\b(?:underage|a minor|a child|(?:1[0-7]|[1-9])\s*(?:years?\s*old|yo))\b/i,
        surfaces: INPUT_AND_PERSONA,
    },
    {
        category: 'minor',
        pattern: /\b(?:i(?:'m| am)|you(?:'re| are))\s+(?:a\s+)?(?:minor|underage)\b/i,
        surfaces: INPUT_AND_PERSONA,
    },
    {
        category: 'self_harm',
        pattern: /\b(?:kill myself|killing myself|end my life|take my own life)\b/i,
        surfaces: INPUT_AND_PERSONA,
    },
    {
        category: 'self_harm',
        pattern: /\bsuicid(?:e|al)\b(?!\s+squad)/i,
        surfaces: INPUT_AND_PERSONA,
    },
    {
        category: 'self_harm',
        pattern: /\b(?:want to die|wanna die)\b(?!\s+(?:of|from)\s+laughter)/i,
        surfaces: INPUT_AND_PERSONA,
    },
    {
        category: 'self_harm',
        pattern: /\b(?:do not|don't|dont) want to (?:live|be alive|exist)\b/i,
        surfaces: INPUT_AND_PERSONA,
    },
    {
        category: 'self_harm',
        pattern:
            /\b(?:self-harm|self harm|cut myself|cutting myself|hurt myself|hang myself|end it all)\b/i,
        surfaces: INPUT_AND_PERSONA,
    },
    {
        category: 'self_harm',
        pattern: /\b(?:kill yourself|kys)\b/i,
        surfaces: OUTPUT_ONLY,
    },
    {
        category: 'self_harm',
        pattern:
            /\b(?:how to|ways to|steps to|you should)\b[\s\S]{0,40}\b(?:kill yourself|commit suicide|end your life|cut yourself)\b/i,
        surfaces: OUTPUT_ONLY,
    },
    {
        category: 'illegal_harm',
        pattern:
            /\b(?:how (?:do i|can i|to)|help me)\s+(?:make|build|assemble|synthesize|cook|produce)\s+(?:a |an )?(?:bomb|explosive|pipe bomb|meth|methamphetamine|fentanyl|napalm)\b/i,
        surfaces: ALL,
    },
    {
        category: 'illegal_harm',
        pattern: /\b(?:make|build)\s+(?:a |an )?(?:bomb|pipe bomb|explosive device)\b/i,
        surfaces: ALL,
    },
    {
        category: 'illegal_harm',
        pattern:
            /\bhow to\s+(?:hack into|break into|steal (?:from|a)|commit murder|kill (?:someone|a person|him|her))\b/i,
        surfaces: ALL,
    },
    {
        category: 'jailbreak',
        pattern:
            /\bignore\s+(?:all\s+|any\s+)?(?:previous|prior|above|your)\s+(?:instructions|rules|guidelines|safety)\b/i,
        surfaces: ALL,
    },
    {
        category: 'jailbreak',
        pattern:
            /\b(?:disregard|bypass|override)\s+(?:your\s+|the\s+)?(?:safety|rules|guidelines|system prompt)\b/i,
        surfaces: ALL,
    },
    {
        category: 'jailbreak',
        pattern: /\b(?:developer|dan)\s+mode\b/i,
        surfaces: ALL,
    },
    {
        category: 'jailbreak',
        pattern: /\byou are now\s+(?:dan|unfiltered|jailbroken)\b/i,
        surfaces: ALL,
    },
    {
        category: 'jailbreak',
        pattern: /\bdo anything now\b/i,
        surfaces: ALL,
    },
    {
        category: 'jailbreak',
        pattern: /\bjailbreak\b/i,
        surfaces: ALL,
    },
];

export function assessLocal(
    text: string,
    surface: ModerationSurface,
): SafetyCategory[] {
    const found: SafetyCategory[] = [];
    for (const rule of RULES) {
        if (!rule.surfaces.has(surface)) continue;
        rule.pattern.lastIndex = 0;
        if (rule.pattern.test(text) && !found.includes(rule.category)) {
            found.push(rule.category);
        }
    }
    return found;
}
