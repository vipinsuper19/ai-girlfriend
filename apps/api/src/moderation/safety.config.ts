import type { Helpline } from './safety-policy.js';

export type ModerationProviderId = 'local' | 'openai' | 'gemini';

export interface SafetyConfig {
    enabled: boolean;
    failClosed: boolean;
    provider: ModerationProviderId;
    moderationModel?: string;
    helplines: Helpline[];
}

const ON = new Set(['1', 'true', 'yes', 'on']);
const OFF = new Set(['0', 'false', 'no', 'off']);

function flag(value: string | undefined, fallback: boolean): boolean {
    if (value == null || value.trim() === '') return fallback;
    const normalized = value.trim().toLowerCase();
    if (ON.has(normalized)) return true;
    if (OFF.has(normalized)) return false;
    return fallback;
}

export function resolveModerationProvider(
    requested: string | undefined,
    env: NodeJS.ProcessEnv,
): ModerationProviderId {
    const name = requested?.trim().toLowerCase();
    if (name === 'local' || name === 'openai' || name === 'gemini') return name;
    if (env.OPENAI_API_KEY?.trim()) return 'openai';
    return 'gemini';
}

export function helplinesFromEnv(env: NodeJS.ProcessEnv): Helpline[] {
    return [
        {
            name: env.CRISIS_HELPLINE_IN_NAME?.trim() || 'Tele-MANAS',
            contact: env.CRISIS_HELPLINE_IN_CONTACT?.trim() || '14416',
            region: 'IN',
            detail:
                env.CRISIS_HELPLINE_IN_DETAIL?.trim() ||
                '24/7 mental health support in India',
        },
        {
            name:
                env.CRISIS_HELPLINE_INTL_NAME?.trim() ||
                'International Association for Suicide Prevention',
            contact:
                env.CRISIS_HELPLINE_INTL_CONTACT?.trim() ||
                'https://www.iasp.info/suicidalthoughts/',
            region: 'INTL',
            detail:
                env.CRISIS_HELPLINE_INTL_DETAIL?.trim() || 'Find a local crisis line',
        },
    ];
}

export function safetyConfigFromEnv(
    env: NodeJS.ProcessEnv = process.env,
): SafetyConfig {
    const enabled = flag(env.MODERATION_ENABLED, true);
    if ((env.NODE_ENV ?? '').toLowerCase() === 'production' && !enabled) {
        throw new Error(
            'MODERATION_ENABLED=false is not allowed when NODE_ENV=production',
        );
    }
    const model = env.MODERATION_MODEL?.trim();
    return {
        enabled,
        failClosed: flag(env.MODERATION_FAIL_CLOSED, true),
        provider: resolveModerationProvider(env.MODERATION_PROVIDER, env),
        ...(model ? { moderationModel: model } : {}),
        helplines: helplinesFromEnv(env),
    };
}
