import { createHash } from 'node:crypto';

export const RESET_AUDIENCE = 'password-reset';
export const RESET_TTL = '30m';

/**
 * Short fingerprint of the stored hash. A reset token carries it, so the
 * token stops working once the password changes, including by that reset.
 */
export function passwordFingerprint(passwordHash: string): string {
    return createHash('sha256').update(passwordHash).digest('hex').slice(0, 24);
}

export function resetSecret(env: NodeJS.ProcessEnv = process.env): string | undefined {
    const own = env['JWT_RESET_SECRET']?.trim();
    if (own) return own;
    const access = env['JWT_ACCESS_SECRET']?.trim();
    return access ? `${access}:${RESET_AUDIENCE}` : undefined;
}

export function resetLink(token: string, env: NodeJS.ProcessEnv = process.env): string {
    const base = (env['APP_URL']?.trim() || 'http://localhost:3000').replace(/\/+$/, '');
    return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

export function resetMail(link: string) {
    return {
        subject: 'Reset your password',
        text: [
            'Someone asked to reset the password for this account.',
            '',
            `Open this link within 30 minutes to choose a new one:\n${link}`,
            '',
            'If it was not you, ignore this email. Your password stays the same.',
        ].join('\n'),
    };
}

export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}
