import { Injectable } from '@nestjs/common';

import type { EmbeddingProvider, EmbeddingResult } from '../interfaces/embedding.provider.js';

const DIMENSIONS = 1536;

/**
 * Test stand-in for Gemini embeddings. Constructed only when LLM_PROVIDER=mock.
 * The vector is constant and non-zero so a similarity query has a defined length.
 */
@Injectable()
export class MockEmbeddingProvider implements EmbeddingProvider {
    async generateEmbedding(input: string): Promise<EmbeddingResult> {
        const text = input.trim();
        if (!text) {
            throw new Error('Cannot generate embedding for empty text');
        }
        return {
            embedding: Array.from({ length: DIMENSIONS }, () => 0.01),
            provider: 'mock',
            model: 'mock',
            dimensions: DIMENSIONS,
        };
    }
}
