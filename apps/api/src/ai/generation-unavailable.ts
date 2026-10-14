import { ServiceUnavailableException } from '@nestjs/common';

import { degradedReason } from '../moderation/classifier-attempt.js';

export const GENERATION_TEMPORARILY_UNAVAILABLE = 'GENERATION_TEMPORARILY_UNAVAILABLE';

/** Seconds a client should wait before sending another chat turn. */
export const GENERATION_RETRY_AFTER_SECONDS = 30;

/**
 * The chat model rejected the turn because its quota is exhausted.
 * Shown as an error, not stored as an assistant message.
 */
export class GenerationTemporarilyUnavailableException extends ServiceUnavailableException {
    constructor() {
        super({
            code: GENERATION_TEMPORARILY_UNAVAILABLE,
            message: 'The companion is temporarily unavailable. Please try again in a moment.',
            retryAfterSeconds: GENERATION_RETRY_AFTER_SECONDS,
        });
    }
}

export function isProviderQuotaError(error: unknown): boolean {
    if (degradedReason(error) === '429') return true;
    if (!error || typeof error !== 'object' || !('cause' in error)) return false;
    const cause = (error as { cause?: unknown }).cause;
    return cause != null && cause !== error && isProviderQuotaError(cause);
}
