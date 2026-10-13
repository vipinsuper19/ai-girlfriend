import {
    Injectable,
    InternalServerErrorException,
} from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';

import { isAbortError } from '../abort-error.js';
import { generationRateLimit } from '../generation-rate-limit.js';
import type {
    AiChatMessage,
    ChatProvider,
    GenerateChatOptions,
} from '../interfaces/chat-provider.interface.js';

@Injectable()
export class GeminiChatProvider implements ChatProvider {
    private readonly client: GoogleGenAI;
    private readonly model: string;

    constructor() {
        const apiKey = process.env['GEMINI_API_KEY'];

        if (!apiKey) {
            throw new Error(
                'GEMINI_API_KEY is not configured',
            );
        }

        this.client = new GoogleGenAI({
            apiKey,
        });

        this.model =
            process.env['GEMINI_CHAT_MODEL'] ??
            'gemini-3.6-flash';

    }

    async generateChat(
        options: GenerateChatOptions,
    ): Promise<string> {
        try {
            const systemInstruction =
                this.getSystemInstruction(options.messages);

            const contents =
                this.toGeminiContents(options.messages);

            const response =
                await this.client.models.generateContent({
                    model: this.model,
                    contents,
                    config: {
                        ...(systemInstruction ? { systemInstruction } : {}),
                        abortSignal: options.signal,
                    },
                });

            const content = response.text?.trim();

            if (!content) {
                throw new Error(
                    'Gemini returned an empty response',
                );
            }

            return content;
        } catch (error) {
            if (options.signal?.aborted || isAbortError(error)) {
                throw error;
            }

            const limited = generationRateLimit(error, {
                provider: 'gemini',
                model: this.model,
                mode: 'generate',
            });
            if (limited) throw limited;

            console.error(
                'Gemini chat generation failed',
                error,
            );

            throw new InternalServerErrorException(
                'Failed to generate AI response',
            );
        }

    }

    async *streamChat(
        options: GenerateChatOptions,
    ): AsyncGenerator<string, void, unknown> {
        try {
            const systemInstruction =
                this.getSystemInstruction(options.messages);

            const contents =
                this.toGeminiContents(options.messages);

            const stream =
                await this.client.models.generateContentStream({
                    model: this.model,
                    contents,
                    config: {
                        ...(systemInstruction ? { systemInstruction } : {}),
                        abortSignal: options.signal,
                    },
                });

            for await (const chunk of stream) {
                if (options.signal?.aborted) return;
                const text = chunk.text;

                if (text) {
                    yield text;
                }
            }
        } catch (error) {
            if (options.signal?.aborted || isAbortError(error)) {
                throw error;
            }

            const limited = generationRateLimit(error, {
                provider: 'gemini',
                model: this.model,
                mode: 'stream',
            });
            if (limited) throw limited;

            console.error(
                'Gemini streaming generation failed',
                error,
            );

            throw new InternalServerErrorException(
                'Failed to stream AI response',
            );
        }

    }

    private getSystemInstruction(
        messages: AiChatMessage[],
    ): string | undefined {
        const systemMessages = messages
            .filter(
                (message) => message.role === 'system',
            )
            .map((message) => message.content.trim())
            .filter(Boolean);

        if (systemMessages.length === 0) {
            return undefined;
        }

        return systemMessages.join('\n\n');

    }

    private toGeminiContents(
        messages: AiChatMessage[],
    ) {
        return messages
            .filter(
                (message) =>
                    message.role !== 'system' &&
                    message.content.trim().length > 0,
            )
            .map((message) => ({
                role:
                    message.role === 'assistant'
                        ? 'model'
                        : 'user',
                parts: [
                    {
                        text: message.content,
                    },
                ],
            }));
    }
}