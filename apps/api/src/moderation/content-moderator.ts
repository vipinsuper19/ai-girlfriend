import type { SafetyCategory } from './safety-policy.js';

export interface ProviderModeration {
    categories: SafetyCategory[];
    /** Present when one call scored several blocks. */
    items?: ReadonlyArray<{ id: string; categories: SafetyCategory[] }>;
}

/**
 * One moderation backend. Gemini is the default JSON classifier.
 * OpenAI uses the same JSON schema when its key is set.
 * `local` means the narrow pre-filter only.
 */
export interface ContentModerator {
    readonly id: string;
    /** When set, the service chunks to this size. A non-positive value flags the text. */
    readonly maxChars?: number;
    moderate(text: string): Promise<ProviderModeration>;
}

export const CONTENT_MODERATOR = Symbol('CONTENT_MODERATOR');
export const SAFETY_CONFIG = Symbol('SAFETY_CONFIG');
