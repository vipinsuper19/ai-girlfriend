/**
 * Postgres unique_violation, including when the driver wraps it.
 * Used so a concurrent duplicate report returns the existing row.
 */
export function isUniqueViolation(error: unknown): boolean {
    const seen = new Set<unknown>();
    let current: unknown = error;

    while (current && typeof current === 'object' && !seen.has(current)) {
        seen.add(current);
        const record = current as {
            code?: unknown;
            message?: unknown;
            cause?: unknown;
        };

        if (record.code === '23505') return true;
        if (
            typeof record.message === 'string' &&
            /duplicate key|unique constraint/i.test(record.message)
        ) {
            return true;
        }

        current = record.cause;
    }

    return false;
}
