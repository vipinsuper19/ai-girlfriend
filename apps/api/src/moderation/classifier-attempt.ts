/**
 * One classifier attempt. Outages fall back instead of waiting through retries.
 * Gemini rejects a server deadline under 10s, so this is a client abort only.
 */
export const CLASSIFIER_TIMEOUT_MIN_MS = 10_000;
export const CLASSIFIER_TIMEOUT_MS = 12_000;

/**
 * Client abort budget. `MODERATION_TIMEOUT_MS` may raise it.
 * Values under 10s clamp up, so nothing sends a shorter deadline.
 */
export function classifierTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
    const raw = env.MODERATION_TIMEOUT_MS?.trim();
    if (!raw) return CLASSIFIER_TIMEOUT_MS;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return CLASSIFIER_TIMEOUT_MS;
    return Math.max(CLASSIFIER_TIMEOUT_MIN_MS, Math.floor(parsed));
}

export type DegradedReason = 'timeout' | '429' | '503' | 'unavailable' | 'empty';

/** Gemini's own filter sometimes returns no text. That is not a scored allow. */
export function isEmptyClassifierResponse(error: unknown): boolean {
    const message = error instanceof Error ? error.message : '';
    return /empty response/i.test(message);
}

/** Why a classifier call could not be used. Never includes the user text. */
export function degradedReason(error: unknown): DegradedReason {
    if (isEmptyClassifierResponse(error)) return 'empty';
    const status = httpStatus(error);
    if (status === 429) return '429';
    if (status === 503) return '503';
    if (isTimeout(error)) return 'timeout';
    const message = error instanceof Error ? error.message : '';
    if (/\b429\b|rate limit/i.test(message)) return '429';
    if (/\b503\b/.test(message)) return '503';
    return 'unavailable';
}

function httpStatus(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const record = error as {
        status?: unknown;
        statusCode?: unknown;
        response?: { status?: unknown };
        error?: { code?: unknown; status?: unknown };
    };
    for (const value of [
        record.status,
        record.statusCode,
        record.response?.status,
        record.error?.status,
        record.error?.code,
    ]) {
        if (typeof value === 'number' && value >= 100 && value <= 599) return value;
        if (typeof value === 'string' && /^\d{3}$/.test(value)) return Number(value);
    }
    return undefined;
}

function isTimeout(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const record = error as { name?: unknown; code?: unknown; message?: unknown };
    const name = typeof record.name === 'string' ? record.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') return true;
    const code = record.code;
    if (code === 'ETIMEDOUT' || code === 'ABORT_ERR' || code === 23) return true;
    const message = typeof record.message === 'string' ? record.message : '';
    return /timeout|timed out|\baborted\b/i.test(message);
}
