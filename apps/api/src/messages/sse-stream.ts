export const SSE_KEEPALIVE_MS = 15_000;
export const SSE_KEEPALIVE = ': ping\n\n';

export function formatSseEvent(type: string, data: unknown): string {
    return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Writes each event as soon as it arrives, and a comment every keepaliveMs
 * while the next event is still pending. Proxies drop idle SSE connections.
 */
export async function writeServerSentEvents(
    events: AsyncIterable<{ type: string }>,
    write: (chunk: string) => void,
    keepaliveMs = SSE_KEEPALIVE_MS,
): Promise<void> {
    const iterator = events[Symbol.asyncIterator]();
    const timer = setInterval(() => {
        write(SSE_KEEPALIVE);
    }, keepaliveMs);

    try {
        while (true) {
            const step = await iterator.next();
            if (step.done) return;
            write(formatSseEvent(step.value.type, step.value));
        }
    } finally {
        clearInterval(timer);
        await iterator.return?.();
    }
}

export type StreamErrorPayload = {
    message: string;
    code?: string;
};

/** Headers are already sent, so the error code rides in the event instead of the status. */
export function streamErrorPayload(error: unknown): StreamErrorPayload {
    const message = error instanceof Error ? error.message : 'Streaming failed';
    const response = (error as { getResponse?: () => unknown } | null)?.getResponse?.();
    const code = typeof response === 'object' && response !== null
        ? (response as { code?: unknown }).code
        : undefined;
    return typeof code === 'string' ? { message, code } : { message };
}
