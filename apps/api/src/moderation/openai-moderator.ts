import OpenAI from 'openai';

import type { ContentModerator, ProviderModeration } from './content-moderator.js';
import { delimitedModerationInput } from './gemini-moderator.js';
import {
    GEMINI_CLASSIFIER_INSTRUCTION,
    parseClassifier,
} from './provider-categories.js';

export const OPENAI_MODERATION_MAX_CHARS = 32_000;

/**
 * Same structured classifier as Gemini. The moderations endpoint does not
 * cover school grades, spelled ages, or Hinglish, so this uses a JSON reply.
 */
export class OpenAiContentModerator implements ContentModerator {
    readonly id = 'openai';
    readonly maxChars = OPENAI_MODERATION_MAX_CHARS;
    private client: OpenAI | null = null;

    constructor(
        private readonly apiKey: string | undefined,
        private readonly model: string,
    ) {}

    async moderate(text: string): Promise<ProviderModeration> {
        if (text.length > this.maxChars) {
            throw new Error('Moderation input exceeds the provider limit');
        }
        if (!this.apiKey) {
            throw new Error('OPENAI_API_KEY is not configured');
        }
        this.client ??= new OpenAI({ apiKey: this.apiKey });
        const response = await this.client.responses.create({
            model: this.model,
            instructions: GEMINI_CLASSIFIER_INSTRUCTION,
            input: delimitedModerationInput(text),
        });
        const raw = response.output_text?.trim();
        if (!raw) {
            throw new Error('Moderation classifier returned an empty response');
        }
        const parsed = parseClassifier(raw);
        return { categories: parsed.categories, items: parsed.items };
    }
}
