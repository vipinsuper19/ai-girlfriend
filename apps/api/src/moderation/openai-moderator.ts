import OpenAI from 'openai';

import type { ContentModerator, ProviderModeration } from './content-moderator.js';
import { categoriesFromOpenAi } from './provider-categories.js';

export const OPENAI_MODERATION_MAX_CHARS = 32_000;

export class OpenAiContentModerator implements ContentModerator {
    readonly id = 'openai';
    readonly maxChars = OPENAI_MODERATION_MAX_CHARS;
    private client: OpenAI | null = null;

    constructor(
        private readonly apiKey: string | undefined,
        readonly model: string,
    ) {}

    async moderate(text: string): Promise<ProviderModeration> {
        if (text.length > this.maxChars) {
            throw new Error('Moderation input exceeds the provider limit');
        }
        if (!this.apiKey) {
            throw new Error('OPENAI_API_KEY is not configured');
        }
        this.client ??= new OpenAI({ apiKey: this.apiKey });
        const response = await this.client.moderations.create({
            model: this.model,
            input: text,
        });
        const categories = response.results[0]?.categories;
        if (!categories) {
            throw new Error('Moderation endpoint returned no result');
        }
        return { categories: categoriesFromOpenAi(categories) };
    }
}
