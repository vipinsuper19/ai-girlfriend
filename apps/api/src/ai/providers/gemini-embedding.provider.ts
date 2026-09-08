import {
    Injectable,
} from '@nestjs/common';
//import { ConfigService } from '@nestjs/config';
import {
    GoogleGenAI,
} from '@google/genai';

import type {
    EmbeddingProvider,
    EmbeddingResult,
} from '../interfaces/embedding.provider.js';

@Injectable()
export class GeminiEmbeddingProvider
    implements EmbeddingProvider {
    private readonly ai: GoogleGenAI;

    private readonly model =
        'gemini-embedding-001';

    constructor(
        //  private readonly configService: ConfigService,
    ) {
        const apiKey = process.env['GEMINI_API_KEY'];

        this.ai = new GoogleGenAI({
            apiKey,
        });

    }

    async generateEmbedding(
        input: string,
    ): Promise<EmbeddingResult> {
        const text = input.trim();

        if (!text) {
            throw new Error(
                'Cannot generate embedding for empty text',
            );
        }

        const response =
            await this.ai.models.embedContent({
                model: this.model,
                contents: text,
                config: {
                    outputDimensionality: 1536,
                },
            });

        const embedding =
            response.embeddings?.[0]?.values;

        if (!embedding) {
            throw new Error(
                'Gemini did not return an embedding',
            );
        }

        return {
            embedding: Array.from(embedding),
            provider: 'GEMINI',
            model: this.model,
            dimensions: embedding.length,
        };

    }
}