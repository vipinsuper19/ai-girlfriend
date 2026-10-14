import assert from 'node:assert/strict';
import test from 'node:test';

import { InternalServerErrorException } from '@nestjs/common';

import { GenerationRateLimitedException } from './generation-rate-limit.js';
import { GenerationTemporarilyUnavailableException } from './generation-unavailable.js';
import { GeminiChatProvider } from './providers/gemini-chat-provider.js';

test('a gemini chat 429 is RATE_LIMITED, a wrapped 429 is a temporary outage, and neither logs the prompt', async () => {
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
        const direct = Object.assign(new Error('echo CANARY prompt'), { status: 429 });
        const directClient = {
            models: {
                async generateContent() {
                    throw direct;
                },
                async generateContentStream() {
                    throw direct;
                },
            },
        };
        (provider as unknown as { client: typeof directClient }).client = directClient;
        await assert.rejects(
            () => provider.generateChat({ messages: [{ role: 'user', content: 'hi' }] }),
            GenerationRateLimitedException,
        );
        await assert.rejects(async () => {
            for await (const _chunk of provider.streamChat({
                messages: [{ role: 'user', content: 'hi' }],
            })) {
                // Rate limit fails before the first chunk.
            }
        }, GenerationRateLimitedException);

        // A 429 only on the cause is not caught by the RATE_LIMITED mapping.
        const quota = new Error('echo CANARY prompt', {
            cause: Object.assign(new Error('echo CANARY prompt'), { status: 429 }),
        });
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
