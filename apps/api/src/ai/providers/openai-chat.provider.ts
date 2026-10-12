import {
    Injectable,
    InternalServerErrorException,
} from '@nestjs/common';
import OpenAI from 'openai';

import { isAbortError } from '../abort-error.js';
import type {
    ChatProvider,
    GenerateChatOptions,
} from '../interfaces/chat-provider.interface.js';

@Injectable()
export class OpenAiChatProvider
    implements ChatProvider {
    private readonly client: OpenAI;
    private readonly model: string;

    constructor() {
        const apiKey = process.env['OPENAI_API_KEY'];

        if (!apiKey) {
            throw new Error(
                'OPENAI_API_KEY is not configured',
            );
        }

        this.client = new OpenAI({
            apiKey,
        });

        this.model =
            process.env['OPENAI_CHAT_MODEL'] ??
            'gpt-5-mini';

    }

    async generateChat(
        options: GenerateChatOptions,
    ): Promise<string> {
        try {
            const response =
                await this.client.responses.create({
                    model: this.model,
                    input: options.messages.map(
                        (message) => ({
                            role: message.role,
                            content: message.content,
                        }),
                    ),
                }, options.signal ? { signal: options.signal } : undefined);

            const content =
                response.output_text?.trim();

            if (!content) {
                throw new Error(
                    'AI provider returned an empty response',
                );
            }

            return content;
        } catch (error) {
            if (options.signal?.aborted || isAbortError(error)) {
                throw error;
            }

            console.error(
                'OpenAI chat generation failed',
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
            const stream =
                await this.client.responses.create({
                    model: this.model,
                    input: options.messages.map(
                        (message) => ({
                            role: message.role,
                            content: message.content,
                        }),
                    ),
                    stream: true,
                }, options.signal ? { signal: options.signal } : undefined);

            for await (const event of stream) {
                if (options.signal?.aborted) return;
                if (
                    event.type ===
                    'response.output_text.delta'
                ) {
                    yield event.delta;
                }
            }
        } catch (error) {
            if (options.signal?.aborted || isAbortError(error)) {
                throw error;
            }

            console.error(
                'OpenAI streaming generation failed',
                error,
            );

            throw new InternalServerErrorException(
                'Failed to stream AI response',
            );
        }
    }
}