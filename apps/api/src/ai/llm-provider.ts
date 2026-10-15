export type LlmProviderId = 'gemini' | 'mock';

/**
 * Chat and embeddings. Unset means Gemini.
 * `mock` is the emulator stand-in: a fixed reply and a fixed vector, with no
 * network client. Production boot rejects it in env validation.
 */
export function llmProviderFromEnv(env: NodeJS.ProcessEnv): LlmProviderId {
    const name = env.LLM_PROVIDER?.trim().toLowerCase();
    if (name == null || name === '' || name === 'gemini') return 'gemini';
    if (name === 'mock') return 'mock';
    throw new Error(`LLM_PROVIDER=${env.LLM_PROVIDER} is not supported`);
}
