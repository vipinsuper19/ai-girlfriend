export interface ClassifierBlock {
    id: string;
    text: string;
}

/** Body sent to one classifier call. A lone user turn stays unwrapped. */
export function classifierBatchBody(blocks: readonly ClassifierBlock[]): string {
    if (blocks.length === 1 && blocks[0]?.id === 'user') return blocks[0].text;
    return blocks.map((block) => `[id=${block.id}]\n${block.text}`).join('\n\n');
}

export function isOverLimitError(error: unknown): boolean {
    return error instanceof Error && /exceeds the provider limit/.test(error.message);
}

/**
 * Keep one classifier body at or under `maxChars`. Memory text is shortened
 * to fit. The user turn is never shortened here; the caller chunks it when
 * `userOverLimit` is set.
 */
export function fitClassifierBlocks(
    blocks: readonly ClassifierBlock[],
    maxChars: number,
): { blocks: ClassifierBlock[]; userOverLimit: boolean } {
    const user = blocks.find((block) => block.id === 'user');
    const memories = blocks.filter((block) => block.id !== 'user');
    if (user && user.text.length > maxChars) {
        return { blocks: [user], userOverLimit: true };
    }

    const chosen: ClassifierBlock[] = user ? [{ id: user.id, text: user.text }] : [];
    for (const memory of memories) {
        const prefix = classifierBatchBody([...chosen, { id: memory.id, text: '' }]);
        const room = maxChars - prefix.length;
        if (room < 1) continue;
        const text = memory.text.length <= room ? memory.text : memory.text.slice(0, room);
        const next = [...chosen, { id: memory.id, text }];
        if (classifierBatchBody(next).length > maxChars) continue;
        chosen.push({ id: memory.id, text });
    }
    return { blocks: chosen, userOverLimit: false };
}
