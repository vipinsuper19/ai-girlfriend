import type { SafetyConfig } from './safety.config.js';
import type { ContentModerator } from './content-moderator.js';
import { GeminiContentModerator, GEMINI_MODERATION_MODEL } from './gemini-moderator.js';
import { OpenAiContentModerator } from './openai-moderator.js';

const LOCAL_MODERATOR: ContentModerator = {
    id: 'local',
    async moderate() {
        return { categories: [] };
    },
};

/** CI and emulator stand-in. It returns no categories; the local rules still run. */
const STUB_MODERATOR: ContentModerator = {
    id: 'stub',
    model: 'stub',
    async moderate() {
        return { categories: [] };
    },
};

/**
 * When the primary moderator is not OpenAI, one moderations call can cover a
 * Gemini outage before the local persona check.
 */
export function openaiModerationFallback(
    config: SafetyConfig,
    env: NodeJS.ProcessEnv,
): ContentModerator | null {
    if (config.provider === 'openai' || config.provider === 'local' || config.provider === 'stub') {
        return null;
    }
    const apiKey = env.OPENAI_API_KEY?.trim();
    if (!apiKey) return null;
    return new OpenAiContentModerator(apiKey, 'omni-moderation-latest');
}

export function createContentModerator(
    config: SafetyConfig,
    env: NodeJS.ProcessEnv,
): ContentModerator {
    if (config.provider === 'stub') return STUB_MODERATOR;
    if (config.provider === 'openai') {
        return new OpenAiContentModerator(
            env.OPENAI_API_KEY?.trim(),
            config.moderationModel || 'omni-moderation-latest',
        );
    }
    if (config.provider === 'gemini') {
        return new GeminiContentModerator(
            env.GEMINI_API_KEY?.trim(),
            config.moderationModel ||
                env.GEMINI_CHAT_MODEL?.trim() ||
                GEMINI_MODERATION_MODEL,
        );
    }
    return LOCAL_MODERATOR;
}
