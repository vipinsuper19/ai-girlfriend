import { Injectable } from '@nestjs/common';

import type { ChatProvider, GenerateChatOptions } from '../interfaces/chat-provider.interface.js';

/** A finished sentence so streamed moderation can release it. Not a model call. */
export const MOCK_CHAT_REPLY = 'Hello. I am right here with you.';

/**
 * Test stand-in for Gemini chat. Constructed only when LLM_PROVIDER=mock.
 * It has no API client.
 */
@Injectable()
export class MockChatProvider implements ChatProvider {
    async generateChat(_options: GenerateChatOptions): Promise<string> {
        return MOCK_CHAT_REPLY;
    }

    async *streamChat(_options: GenerateChatOptions): AsyncGenerator<string, void, unknown> {
        yield MOCK_CHAT_REPLY;
    }
}
