/** Rough spend proxy: about four characters per token. Not a provider invoice. */
export function estimateTokens(text: string): number {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return Math.ceil(trimmed.length / 4);
}
