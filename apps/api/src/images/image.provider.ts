export type GeneratedImage = {
    bytes: Buffer;
    mimeType: string;
    provider: string;
    model: string;
};

export interface ImageProvider {
    generateImage(prompt: string): Promise<GeneratedImage>;
}

export const IMAGE_PROVIDER = Symbol('IMAGE_PROVIDER');
