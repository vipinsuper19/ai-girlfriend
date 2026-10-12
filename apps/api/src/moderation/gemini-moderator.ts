import {
    GoogleGenAI,
    HarmBlockThreshold,
    HarmCategory,
} from '@google/genai';

import type { ContentModerator, ProviderModeration } from './content-moderator.js';
import {
    categoriesFromClassifier,
    GEMINI_CLASSIFIER_INSTRUCTION,
} from './provider-categories.js';

const INPUT_LIMIT = 8_000;

const SAFETY_OFF = [
    HarmCategory.HARM_CATEGORY_HARASSMENT,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
    HarmCategory.HARM_CATEGORY_JAILBREAK,
];

/**
 * Gemini has no separate moderations endpoint. This asks the configured chat
 * model to return category JSON only, with safety filters open so the
 * classifier can see the text it is scoring.
 */
export class GeminiContentModerator implements ContentModerator {
    readonly id = 'gemini';
    private client: GoogleGenAI | null = null;

    constructor(
        private readonly apiKey: string | undefined,
        private readonly model: string,
    ) {}

    async moderate(text: string): Promise<ProviderModeration> {
        if (!this.apiKey) {
            throw new Error('GEMINI_API_KEY is not configured');
        }
        this.client ??= new GoogleGenAI({ apiKey: this.apiKey });
        const response = await this.client.models.generateContent({
            model: this.model,
            contents: text.slice(0, INPUT_LIMIT),
            config: {
                systemInstruction: GEMINI_CLASSIFIER_INSTRUCTION,
                temperature: 0,
                responseMimeType: 'application/json',
                safetySettings: SAFETY_OFF.map((category) => ({
                    category,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                })),
            },
        });
        const raw = response.text?.trim();
        if (!raw) {
            throw new Error('Moderation classifier returned an empty response');
        }
        return { categories: categoriesFromClassifier(raw) };
    }
}
