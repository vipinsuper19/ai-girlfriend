const tails = new Map<number, Promise<void>>();

/**
 * Serializes assistant generation for one conversation inside this process.
 * A retry that arrives while the original stream is still running waits,
 * then sees the persisted reply instead of calling the model again.
 */
export function acquireConversationLock(
    conversationId: number,
): Promise<() => void> {
    const previous = tails.get(conversationId) ?? Promise.resolve();
    let releaseGate: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
        releaseGate = resolve;
    });
    const tail = previous.catch(() => undefined).then(() => gate);
    tails.set(conversationId, tail);

    return previous.catch(() => undefined).then(() => {
        let released = false;
        return () => {
            if (released) return;
            released = true;
            releaseGate();
            if (tails.get(conversationId) === tail) {
                tails.delete(conversationId);
            }
        };
    });
}

export async function withConversationLock<T>(
    conversationId: number,
    run: () => Promise<T>,
): Promise<T> {
    const release = await acquireConversationLock(conversationId);
    try {
        return await run();
    } finally {
        release();
    }
}
