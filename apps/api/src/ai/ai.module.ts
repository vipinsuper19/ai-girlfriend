import { Module } from '@nestjs/common';

import { AiService } from './ai.service.js';
import { CHAT_PROVIDER } from './interfaces/chat-provider.interface.js';
//import { OpenAiChatProvider } from './providers/openai-chat.provider.js';
import { GeminiChatProvider } from './providers/gemini-chat-provider.js';
import {
    EMBEDDING_PROVIDER,
} from './interfaces/embedding.provider.js';
import { GeminiEmbeddingProvider } from './providers/gemini-embedding.provider.js';

@Module({
    providers: [
        AiService,
        // OpenAiChatProvider,
        GeminiChatProvider,

        {
            provide: CHAT_PROVIDER,
            useExisting: GeminiChatProvider,
        },
        GeminiEmbeddingProvider,
        {
            provide: EMBEDDING_PROVIDER,
            useExisting: GeminiEmbeddingProvider,
        },
    ],
    exports: [AiService, CHAT_PROVIDER, EMBEDDING_PROVIDER],
})
export class AiModule { }