const STRING_FIELDS = ['code', 'feature', 'period', 'resetsAt'] as const;
const NUMBER_FIELDS = [
    'limit',
    'used',
    'requested',
    'remaining',
    'retryAfterSeconds',
] as const;

/** Fields the API is willing to show clients on an error body or SSE error event. */
export function publicErrorFields(body: unknown): Record<string, string | number> {
    if (typeof body !== 'object' || body === null) return {};
    const source = body as Record<string, unknown>;
    const extra: Record<string, string | number> = {};

    for (const key of STRING_FIELDS) {
        const value = source[key];
        if (typeof value === 'string' && value.length > 0) extra[key] = value;
    }
    for (const key of NUMBER_FIELDS) {
        const value = source[key];
        if (typeof value === 'number' && Number.isFinite(value)) extra[key] = value;
    }
    return extra;
}
