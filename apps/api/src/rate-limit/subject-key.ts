/**
 * Per-user bucket key. Authenticated routes use the account id. Login,
 * register, and forgot-password use the email. Reset uses the token prefix
 * because that body has no account id.
 */
export function rateLimitSubject(request: {
    user?: { sub?: string | number | null };
    body?: { email?: unknown; token?: unknown };
}): string | null {
    const sub = request.user?.sub;
    if (sub != null && String(sub).trim().length > 0) {
        return `id:${String(sub).trim()}`;
    }

    const email = request.body?.email;
    if (typeof email === 'string' && email.includes('@')) {
        return `email:${email.trim().toLowerCase()}`;
    }

    const token = request.body?.token;
    if (typeof token === 'string' && token.trim().length >= 8) {
        return `token:${token.trim().slice(0, 24)}`;
    }

    return null;
}
