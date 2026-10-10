import {
    BadGatewayException,
    Injectable,
    ServiceUnavailableException,
    UnprocessableEntityException,
} from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';

import type { GeneratedImage, ImageProvider } from '../image.provider.js';

@Injectable()
export class GeminiImageProvider implements ImageProvider {
    private client: GoogleGenAI | null = null;

    private get model(): string {
        return process.env['GEMINI_IMAGE_MODEL'] ?? 'imagen-4.0-generate-001';
    }

    async generateImage(prompt: string): Promise<GeneratedImage> {
        const apiKey = process.env['GEMINI_API_KEY'];
        if (!apiKey) {
            throw new ServiceUnavailableException('Image generation is not configured');
        }
        this.client ??= new GoogleGenAI({ apiKey });

        let bytes: string | undefined;
        let mimeType: string | undefined;
        try {
            const response = await this.client.models.generateImages({
                model: this.model,
                prompt,
                config: { numberOfImages: 1, outputMimeType: 'image/png' },
            });
            const image = response.generatedImages?.[0]?.image;
            bytes = image?.imageBytes;
            mimeType = image?.mimeType;
        } catch {
            throw new BadGatewayException('The image service did not answer');
        }

        if (!bytes) {
            throw new UnprocessableEntityException('That image could not be made. Try a different scene.');
        }

        return {
            bytes: Buffer.from(bytes, 'base64'),
            mimeType: mimeType ?? 'image/png',
            provider: 'GEMINI',
            model: this.model,
        };
    }
}
