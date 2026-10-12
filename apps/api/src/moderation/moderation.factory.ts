import type { SafetyConfig } from './safety.config.js';
import type { ContentModerator } from './content-moderator.js';
import { GeminiContentModerator } from './gemini-moderator.js';
import { OpenAiContentModerator } from './openai-moderator.js';

const LOCAL_MODERATOR: ContentModerator = {
    id: 'local',
    async moderate() {
        return { categories: [] };
    },
};

export function createContentModerator(
    config: SafetyConfig,
    env: NodeJS.ProcessEnv,
): ContentModerator {
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
                'gemini-3.6-flash',
        );
    }
    return LOCAL_MODERATOR;
}
