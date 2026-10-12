import { ServiceUnavailableException } from '@nestjs/common';

export const MODERATION_TEMPORARILY_UNAVAILABLE = 'MODERATION_TEMPORARILY_UNAVAILABLE';

/** Seconds a client should wait before creating or editing a companion again. */
export const MODERATION_RETRY_AFTER_SECONDS = 30;

/**
 * The local persona check could not run after the provider failed.
 * This is not UNSAFE_PERSONA: the description was not judged unsafe.
 */
export class ModerationTemporarilyUnavailableException extends ServiceUnavailableException {
    constructor() {
        super({
            code: MODERATION_TEMPORARILY_UNAVAILABLE,
            message: 'Safety checks are temporarily unavailable. Try again in a moment.',
            retryAfterSeconds: MODERATION_RETRY_AFTER_SECONDS,
        });
    }
}
