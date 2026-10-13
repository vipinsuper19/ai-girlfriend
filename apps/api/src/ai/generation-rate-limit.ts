import { HttpException, HttpStatus, Logger } from '@nestjs/common';

export const DEFAULT_RETRY_AFTER_SECONDS = 30;
const MAX_RETRY_AFTER_SECONDS = 600;

/**
 * Chat generation hit the provider rate limit. The SSE error event carries
 * `code: 'RATE_LIMITED'` and `retryAfterSeconds`; the reply is not stored
 * and the turn is not charged.
 */
export class GenerationRateLimitedException extends HttpException {
    constructor(public readonly retryAfterSeconds: number) {
        super(
            {
                code: 'RATE_LIMITED',
                message: 'Give me a moment, then try again.',
                retryAfterSeconds,
            },
            HttpStatus.TOO_MANY_REQUESTS,
        );
    }
}

/** HTTP 429 or a provider code of RESOURCE_EXHAUSTED. Message text is not consulted. */
export function isGenerationRateLimited(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const record = error as { status?: unknown; code?: unknown };
    if (record.status === 429 || record.code === 429) return true;
    return record.status === 'RESOURCE_EXHAUSTED' || record.code === 'RESOURCE_EXHAUSTED';
}

/**
 * Seconds from the provider's RetryInfo (`retryDelay: "31s"`) or a
 * `retryAfter` / `Retry-After` value; 30 when none is given.
 */
export function retryAfterSecondsFrom(error: unknown): number {
    const candidates: unknown[] = [];
    if (error && typeof error === 'object') {
        const record = error as Record<string, unknown>;
        candidates.push(record.retryAfter, record.retryAfterSeconds);
        const headers = record.headers as { get?: (name: string) => unknown } | Record<string, unknown> | undefined;
        if (headers && typeof (headers as { get?: unknown }).get === 'function') {
            candidates.push((headers as { get: (name: string) => unknown }).get('retry-after'));
        } else if (headers && typeof headers === 'object') {
            candidates.push((headers as Record<string, unknown>)['retry-after']);
        }
    }
    for (const value of candidates) {
        const seconds = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
        if (Number.isFinite(seconds) && seconds > 0) return clamp(seconds);
    }
    let text = '';
    try {
        const record = error as { message?: unknown; details?: unknown };
        text = `${typeof record?.message === 'string' ? record.message : ''} ${record?.details ? JSON.stringify(record.details) : ''}`;
    } catch {
        text = '';
    }
    const match = text.match(/"?retryDelay"?\s*:\s*"(\d+(?:\.\d+)?)s"/);
    if (match?.[1]) return clamp(Number(match[1]));
    return DEFAULT_RETRY_AFTER_SECONDS;
}

function clamp(seconds: number): number {
    return Math.min(MAX_RETRY_AFTER_SECONDS, Math.max(1, Math.ceil(seconds)));
}

export interface RateLimitLogger {
    warn(message: string): void;
}

const defaultLogger = new Logger('GeminiChatProvider');

/** Maps a provider 429 to the client error and logs `generation.rate_limited`. Returns null otherwise. */
export function generationRateLimit(
    error: unknown,
    meta: { provider: string; model: string; mode: 'stream' | 'generate' },
    logger: RateLimitLogger = defaultLogger,
): GenerationRateLimitedException | null {
    if (!isGenerationRateLimited(error)) return null;
    const retryAfterSeconds = retryAfterSecondsFrom(error);
    logger.warn(
        [
            'generation.rate_limited',
            `provider=${meta.provider}`,
            `model=${meta.model}`,
            `mode=${meta.mode}`,
            `retryAfterSeconds=${retryAfterSeconds}`,
        ].join(' '),
    );
    return new GenerationRateLimitedException(retryAfterSeconds);
}
