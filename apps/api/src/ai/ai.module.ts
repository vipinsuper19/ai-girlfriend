import { Module, forwardRef } from '@nestjs/common';

import { AiService } from './ai.service.js';
import { CHAT_PROVIDER } from './interfaces/chat-provider.interface.js';
import { EMBEDDING_PROVIDER } from './interfaces/embedding.provider.js';
import { llmProviderFromEnv } from './llm-provider.js';
import { GeminiChatProvider } from './providers/gemini-chat-provider.js';
import { GeminiEmbeddingProvider } from './providers/gemini-embedding.provider.js';
import { MockChatProvider } from './providers/mock-chat.provider.js';
import { MockEmbeddingProvider } from './providers/mock-embedding.provider.js';
import { MemoriesModule } from '../memories/memories.module.js';
import { ModerationModule } from '../moderation/moderation.module.js';

const modelProviders = llmProviderFromEnv(process.env) === 'mock'
    ? [
        MockChatProvider,
        { provide: CHAT_PROVIDER, useExisting: MockChatProvider },
        MockEmbeddingProvider,
        { provide: EMBEDDING_PROVIDER, useExisting: MockEmbeddingProvider },
    ]
    : [
        GeminiChatProvider,
        { provide: CHAT_PROVIDER, useExisting: GeminiChatProvider },
        GeminiEmbeddingProvider,
        { provide: EMBEDDING_PROVIDER, useExisting: GeminiEmbeddingProvider },
    ];

@Module({
    imports: [forwardRef(() => MemoriesModule), ModerationModule],
    providers: [AiService, ...modelProviders],
    exports: [AiService, CHAT_PROVIDER, EMBEDDING_PROVIDER],
})
export class AiModule { }
