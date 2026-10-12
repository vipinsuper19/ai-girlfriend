/** Shared windows for provider limits and streamed output checks. */

export const MODERATION_CHUNK_OVERLAP = 200;
export const STREAM_WINDOW_CHARS = 400;

/**
 * Split text into pieces no longer than `maxChars`, overlapping so a phrase
 * on a boundary is still scored. A non-positive limit returns no pieces,
 * which the moderation service treats as flagged.
 */
export function textChunks(
    text: string,
    maxChars: number,
    overlap = MODERATION_CHUNK_OVERLAP,
): string[] {
    if (!Number.isFinite(maxChars) || maxChars < 1) return [];
    if (text.length <= maxChars) return [text];
    const safeOverlap = Math.min(Math.max(0, overlap), maxChars - 1);
    const step = maxChars - safeOverlap;
    const chunks: string[] = [];
    for (let start = 0; start < text.length; start += step) {
        chunks.push(text.slice(start, start + maxChars));
        if (start + maxChars >= text.length) break;
    }
    return chunks;
}

const SENTENCE_BOUNDARY = /(?:[.!?।]["'”’)\]]*|\n+)\s*/;

/**
 * Release one sentence, or a bounded span once the buffer is long enough.
 * A short unfinished span stays buffered so streaming can keep moving.
 */
export function takeReadyWindow(
    buffer: string,
    maxChars = STREAM_WINDOW_CHARS,
): { ready: string | null; rest: string } {
    const match = SENTENCE_BOUNDARY.exec(buffer);
    if (match && match.index >= 0 && match[0].length > 0) {
        const end = match.index + match[0].length;
        if (end > 0) {
            return { ready: buffer.slice(0, end), rest: buffer.slice(end) };
        }
    }
    if (maxChars > 0 && buffer.length >= maxChars) {
        const space = buffer.lastIndexOf(' ', maxChars);
        const end = space > 0 ? space + 1 : maxChars;
        return { ready: buffer.slice(0, end), rest: buffer.slice(end) };
    }
    return { ready: null, rest: buffer };
}
