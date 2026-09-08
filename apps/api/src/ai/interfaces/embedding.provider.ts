export const EMBEDDING_PROVIDER =
    Symbol('EMBEDDING_PROVIDER');

export interface EmbeddingResult {
    embedding: number[];
    provider: string;
    model: string;
    dimensions: number;
}

export interface EmbeddingProvider {
    generateEmbedding(
        input: string,
    ): Promise<EmbeddingResult>;
}