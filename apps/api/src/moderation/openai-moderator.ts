import OpenAI from 'openai';

import type { ContentModerator, ProviderModeration } from './content-moderator.js';
import { categoriesFromOpenAi } from './provider-categories.js';

const INPUT_LIMIT = 32_000;

export class OpenAiContentModerator implements ContentModerator {
    readonly id = 'openai';
    private client: OpenAI | null = null;

    constructor(
        private readonly apiKey: string | undefined,
        private readonly model: string,
    ) {}

    async moderate(text: string): Promise<ProviderModeration> {
        if (!this.apiKey) {
            throw new Error('OPENAI_API_KEY is not configured');
        }
        this.client ??= new OpenAI({ apiKey: this.apiKey });
        const response = await this.client.moderations.create({
            model: this.model,
            input: text.slice(0, INPUT_LIMIT),
        });
        const categories = response.results[0]?.categories;
        if (!categories) {
            throw new Error('Moderation endpoint returned no result');
        }
        return { categories: categoriesFromOpenAi(categories) };
    }
}
