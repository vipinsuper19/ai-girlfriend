import assert from 'node:assert/strict';
import test from 'node:test';

import { InternalServerErrorException } from '@nestjs/common';

import { GenerationTemporarilyUnavailableException } from './generation-unavailable.js';
import { GeminiChatProvider } from './providers/gemini-chat-provider.js';

test('a gemini chat 429 is a temporary outage and does not log the prompt', async () => {
    const previous = process.env['GEMINI_API_KEY'];
    process.env['GEMINI_API_KEY'] = 'test-key';
    const logs: string[] = [];
    try {
        const provider = new GeminiChatProvider();
        (provider as unknown as { logger: { warn(message: string): void } }).logger = {
            warn(message) {
                logs.push(message);
            },
        };
        const quota = Object.assign(new Error('echo CANARY prompt'), { status: 429 });
        const client = {
            models: {
                async generateContent() {
                    throw quota;
                },
                async generateContentStream() {
                    throw quota;
                },
            },
        };
        (provider as unknown as { client: typeof client }).client = client;

        await assert.rejects(
            () => provider.generateChat({ messages: [{ role: 'user', content: 'hi' }] }),
            GenerationTemporarilyUnavailableException,
        );
        await assert.rejects(async () => {
            for await (const _chunk of provider.streamChat({
                messages: [{ role: 'user', content: 'hi' }],
            })) {
                // Quota fails before the first chunk.
            }
        }, GenerationTemporarilyUnavailableException);
        assert.match(logs.join('\n'), /provider quota exhausted provider=gemini reason=429/);
        assert.equal(logs.some((line) => line.includes('CANARY')), false);

        (provider as unknown as { client: typeof client }).client = {
            models: {
                async generateContent() {
                    throw new Error('other failure');
                },
                async generateContentStream() {
                    throw new Error('other failure');
                },
            },
        };
        await assert.rejects(
            () => provider.generateChat({ messages: [{ role: 'user', content: 'hi' }] }),
            InternalServerErrorException,
        );
    } finally {
        if (previous === undefined) delete process.env['GEMINI_API_KEY'];
        else process.env['GEMINI_API_KEY'] = previous;
    }
});
