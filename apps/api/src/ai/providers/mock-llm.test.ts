import assert from 'node:assert/strict';
import test from 'node:test';

import { llmProviderFromEnv } from '../llm-provider.js';
import { MOCK_CHAT_REPLY, MockChatProvider } from './mock-chat.provider.js';
import { MockEmbeddingProvider } from './mock-embedding.provider.js';

test('the mock LLM turns on only when LLM_PROVIDER=mock', () => {
    assert.equal(llmProviderFromEnv({}), 'gemini');
    assert.equal(llmProviderFromEnv({ LLM_PROVIDER: 'gemini' }), 'gemini');
    assert.equal(llmProviderFromEnv({ LLM_PROVIDER: ' mock ' }), 'mock');
    assert.throws(() => llmProviderFromEnv({ LLM_PROVIDER: 'openai' }), /not supported/);
});

test('mock chat returns one finished sentence and opens no client', async () => {
    const provider = new MockChatProvider();
    assert.equal(await provider.generateChat({ messages: [] }), MOCK_CHAT_REPLY);
    assert.match(MOCK_CHAT_REPLY, /[.!?]$/);
    const chunks: string[] = [];
    for await (const chunk of provider.streamChat({ messages: [] })) chunks.push(chunk);
    assert.deepEqual(chunks, [MOCK_CHAT_REPLY]);
});

test('mock embedding is a fixed 1536-d vector', async () => {
    const result = await new MockEmbeddingProvider().generateEmbedding('hello');
    assert.equal(result.provider, 'mock');
    assert.equal(result.dimensions, 1536);
    assert.equal(result.embedding.length, 1536);
    assert.ok(result.embedding.every((value) => value === 0.01));
    await assert.rejects(
        () => new MockEmbeddingProvider().generateEmbedding('  '),
        /empty text/,
    );
});
