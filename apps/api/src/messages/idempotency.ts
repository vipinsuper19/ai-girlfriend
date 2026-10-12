import { BadRequestException } from '@nestjs/common';

/** How long a send can be retried with the same Idempotency-Key. */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `null` when the client did not send a key. A non-UUID is rejected so a
 * typo cannot silently create duplicates.
 */
export function parseIdempotencyKey(
    raw: string | string[] | undefined | null,
): string | null {
    if (raw == null) return null;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value == null) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!UUID.test(trimmed)) {
        throw new BadRequestException({
            statusCode: 400,
            message: 'Idempotency-Key must be a UUID',
            error: 'Bad Request',
            code: 'INVALID_IDEMPOTENCY_KEY',
        });
    }
    return trimmed.toLowerCase();
}

export function idempotencyFresh(
    createdAt: string | null | undefined,
    now = Date.now(),
): boolean {
    if (!createdAt) return false;
    const created = Date.parse(createdAt);
    if (!Number.isFinite(created)) return false;
    return now - created < IDEMPOTENCY_TTL_MS;
}
