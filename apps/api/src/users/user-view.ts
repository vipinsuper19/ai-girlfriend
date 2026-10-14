export type UserRow = {
    id: number | string;
    email: string;
    displayName?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    memoryPausedAt?: string | null;
    notificationsEnabledAt?: string | null;
    ageConfirmedAt?: string | null;
};

/** ISO time the 18+ attestation was stored, or null when it has not been. */
export function publicAgeConfirmedAt(value: unknown): string | null {
    if (value == null || value === '') return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }
    if (typeof value !== 'string') return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function userView(user: UserRow) {
    return {
        id: user.id,
        email: user.email,
        displayName: user.displayName ?? null,
        createdAt: user.createdAt ?? null,
        updatedAt: user.updatedAt ?? null,
        memoryPaused: user.memoryPausedAt != null,
        notificationsEnabled: user.notificationsEnabledAt != null,
        ageConfirmedAt: publicAgeConfirmedAt(user.ageConfirmedAt),
    };
}

/** User object on register, login, refresh, and Google/Firebase session responses. */
export function sessionUser(user: {
    id: number | string;
    email: string;
    displayName?: string | null;
    ageConfirmedAt?: unknown;
}) {
    return {
        id: user.id,
        email: user.email,
        displayName: user.displayName ?? null,
        ageConfirmedAt: publicAgeConfirmedAt(user.ageConfirmedAt),
    };
}

/** A flag is stored as the time it was turned on, and null while off. */
export function flagColumn(
    enabled: boolean | undefined,
    current: string | null | undefined,
    now: string,
): string | null | undefined {
    if (enabled === undefined) return undefined;
    if (!enabled) return null;
    return current ?? now;
}

const SECRET_KEYS = new Set([
    'passwordHash',
    'refreshToken',
    'token',
    'embedding',
]);

/** Copies rows for export without credentials, tokens, or vectors. */
export function exportRows<T extends Record<string, unknown>>(
    rows: readonly T[],
): Record<string, unknown>[] {
    return rows.map((row) => {
        const copy: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
            if (!SECRET_KEYS.has(key)) copy[key] = value;
        }
        return copy;
    });
}
