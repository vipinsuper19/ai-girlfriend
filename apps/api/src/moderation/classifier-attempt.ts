/** One classifier attempt. Outages fall back instead of waiting through retries. */
export const CLASSIFIER_TIMEOUT_MS = 4_000;

export type DegradedReason = 'timeout' | '429' | '503' | 'unavailable';

/**
 * Why a classifier call could not be used. Never includes the user text.
 * `429` covers numeric rate limits and Gemini quota errors (`RESOURCE_EXHAUSTED`).
 */
export function degradedReason(error: unknown): DegradedReason {
    const status = httpStatus(error);
    if (status === 429) return '429';
    if (status === 503) return '503';
    if (isTimeout(error)) return 'timeout';
    const code = rawCode(error);
    if (code === 'RESOURCE_EXHAUSTED' || code === '429') return '429';
    if (code === 'UNAVAILABLE' || code === '503') return '503';
    const message = error instanceof Error ? error.message : '';
    if (/\b429\b|rate limit|resource exhausted|quota/i.test(message)) return '429';
    if (/\b503\b/.test(message)) return '503';
    return 'unavailable';
}

/** Bound one provider call. A late rejection from the original promise is ignored. */
export function withAttemptTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            const error = new Error('Moderation provider timed out');
            error.name = 'TimeoutError';
            reject(error);
        }, ms);
        work.then(
            (value) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(value);
            },
            (error: unknown) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                reject(error);
            },
        );
    });
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

function rawCode(error: unknown): string | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const record = error as {
        code?: unknown;
        status?: unknown;
        error?: { code?: unknown; status?: unknown };
    };
    for (const value of [record.code, record.status, record.error?.status, record.error?.code]) {
        if (typeof value === 'string' && value.trim()) return value.trim();
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
