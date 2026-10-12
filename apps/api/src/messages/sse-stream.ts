import { publicErrorFields } from '../common/http-error-fields.js';

export const SSE_KEEPALIVE_MS = 20_000;
export const SSE_KEEPALIVE = ': ping\n\n';

export function formatSseEvent(type: string, data: unknown): string {
    return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Writes each event as soon as it arrives, and a comment every keepaliveMs
 * while the next event is still pending. Proxies drop idle SSE connections.
 *
 * A failed write calls `stop` (the caller aborts the provider) and then
 * `iterator.return()`, which drops a partial reply before it is persisted.
 * `signal` ends the loop once that abort has landed so we do not pull again.
 */
export async function writeServerSentEvents(
    events: AsyncIterable<{ type: string }>,
    write: (chunk: string) => void,
    keepaliveMs = SSE_KEEPALIVE_MS,
    signal?: AbortSignal,
    stop?: () => void,
): Promise<void> {
    const iterator = events[Symbol.asyncIterator]();
    const timer = setInterval(() => {
        try {
            write(SSE_KEEPALIVE);
        } catch {
            stop?.();
        }
    }, keepaliveMs);

    try {
        while (true) {
            if (signal?.aborted) return;
            const step = await iterator.next();
            if (step.done || signal?.aborted) return;
            try {
                write(formatSseEvent(step.value.type, step.value));
            } catch (error) {
                stop?.();
                throw error;
            }
        }
    } finally {
        clearInterval(timer);
        await iterator.return?.();
    }
}

export type StreamErrorPayload = {
    message: string;
    code?: string;
    feature?: string;
    limit?: number;
    used?: number;
    requested?: number;
    remaining?: number;
    period?: string;
    resetsAt?: string;
    retryAfterSeconds?: number;
};

/** Headers are already sent, so the error code rides in the event instead of the status. */
export function streamErrorPayload(error: unknown): StreamErrorPayload {
    const message = error instanceof Error ? error.message : 'Streaming failed';
    const response = (error as { getResponse?: () => unknown } | null)?.getResponse?.();
    return {
        message,
        ...publicErrorFields(response),
    };
}
