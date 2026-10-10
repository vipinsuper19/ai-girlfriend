export type SessionRow = {
    userId: string | number;
    expiresAt: string | Date | null | undefined;
};

export function sessionExpired(
    expiresAt: string | Date | null | undefined,
    now: Date,
): boolean {
    if (expiresAt == null) return true;
    const at = expiresAt instanceof Date
        ? expiresAt.getTime()
        : Date.parse(expiresAt);
    return !Number.isFinite(at) || at <= now.getTime();
}

/**
 * An access token only counts while its session row still exists, so logout,
 * a password change, and account deletion end it before the JWT expires.
 */
export function sessionIsLive(
    session: SessionRow | null | undefined,
    userId: string | number,
    now: Date,
): boolean {
    if (!session) return false;
    if (String(session.userId) !== String(userId)) return false;
    return !sessionExpired(session.expiresAt, now);
}

export function accountCanSignIn(status: string | null | undefined): boolean {
    return status == null || status === 'ACTIVE';
}
