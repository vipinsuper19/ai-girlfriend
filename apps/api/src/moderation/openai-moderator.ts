import OpenAI from 'openai';

import { CLASSIFIER_TIMEOUT_MS, classifierTimeoutMs } from './classifier-attempt.js';
import type { ContentModerator, ProviderModeration } from './content-moderator.js';
import { delimitedModerationInput } from './gemini-moderator.js';
import {
    GEMINI_CLASSIFIER_INSTRUCTION,
    parseClassifier,
} from './provider-categories.js';

export const OPENAI_MODERATION_MAX_CHARS = 32_000;

/** One attempt. The SDK's default is two retries, including on 429 and 5xx. */
export const OPENAI_MODERATION_REQUEST = {
    timeout: CLASSIFIER_TIMEOUT_MS,
    maxRetries: 0,
} as const;

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
        const timeout = classifierTimeoutMs();
        this.client ??= new OpenAI({
            apiKey: this.apiKey,
            timeout,
            maxRetries: OPENAI_MODERATION_REQUEST.maxRetries,
        });
        const response = await this.client.responses.create(
            {
                model: this.model,
                instructions: GEMINI_CLASSIFIER_INSTRUCTION,
                input: delimitedModerationInput(text),
            },
            { timeout, maxRetries: OPENAI_MODERATION_REQUEST.maxRetries },
        );
        const raw = response.output_text?.trim();
        if (!raw) {
            throw new Error('Moderation classifier returned an empty response');
        }
        const parsed = parseClassifier(raw);
        return { categories: parsed.categories, items: parsed.items };
    }
}
