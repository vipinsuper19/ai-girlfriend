import type { SafetyCategory } from './safety-policy.js';

export interface ProviderModeration {
    categories: SafetyCategory[];
}

/**
 * One moderation backend. OpenAI uses the moderations endpoint.
 * Gemini uses a JSON classifier on the chat model already configured for the app.
 * `local` means patterns only.
 */
export interface ContentModerator {
    readonly id: string;
    /** When set, the service chunks to this size. A non-positive value flags the text. */
    readonly maxChars?: number;
    moderate(text: string): Promise<ProviderModeration>;
}

export const CONTENT_MODERATOR = Symbol('CONTENT_MODERATOR');
export const SAFETY_CONFIG = Symbol('SAFETY_CONFIG');
