export type AiChatRole =
    | 'system'
    | 'user'
    | 'assistant';

export interface AiChatMessage {
    role: AiChatRole;
    content: string;
}

export interface GenerateChatOptions {
    messages: AiChatMessage[];
}

export interface ChatProvider {
    generateChat(
        options: GenerateChatOptions,
    ): Promise<string>;

    streamChat(
        options: GenerateChatOptions,
    ): AsyncGenerator<string, void, unknown>;
}

export const CHAT_PROVIDER = Symbol('CHAT_PROVIDER');
