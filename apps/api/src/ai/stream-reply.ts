import { isAbortError } from './abort-error.js';

export type StreamReplyEvent =
    | { type: 'delta'; content: string }
    | { type: 'done'; message: unknown };

/**
 * Forwards provider chunks and persists only after the stream finishes and
 * the caller has not aborted. `iterator.return()` (client Stop / disconnect)
 * skips `persist`, so a partial reply is neither saved nor chargeable.
 */
export async function* streamReply(options: {
    chunks: AsyncIterable<string>;
    signal?: AbortSignal;
    persist: (text: string) => Promise<unknown>;
}): AsyncGenerator<StreamReplyEvent> {
    const signal = options.signal;
    const iterator = options.chunks[Symbol.asyncIterator]();
    let full = '';

    try {
        while (true) {
            if (signal?.aborted) return;
            const step = await iterator.next();
            if (step.done) break;
            if (signal?.aborted) return;
            const chunk = step.value;
            if (!chunk) continue;
            full += chunk;
            yield { type: 'delta', content: chunk };
        }
    } catch (error) {
        if (signal?.aborted || isAbortError(error)) return;
        throw error;
    } finally {
        await iterator.return?.();
    }

    if (signal?.aborted) return;
    const text = full.trim();
    if (!text) {
        throw new Error('AI provider returned an empty response');
    }
    const message = await options.persist(text);
    if (signal?.aborted) return;
    yield { type: 'done', message };
}
