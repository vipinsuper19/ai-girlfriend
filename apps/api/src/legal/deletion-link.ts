import { createHash, randomBytes } from 'node:crypto';

import type { Request } from 'express';

export function newDeletionToken(): string {
    return randomBytes(32).toString('base64url');
}

export function hashDeletionToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export function requestOrigin(request: Request): string {
    const host = request.get('host');
    if (!host) return 'http://localhost:3001';
    return `${request.protocol}://${host}`;
}

export function deletionConfirmLink(origin: string, token: string): string {
    const base = origin.replace(/\/+$/, '');
    return `${base}/account-deletion/confirm?token=${encodeURIComponent(token)}`;
}

export function deletionConfirmMail(link: string): string {
    return [
        'Someone asked to delete the AiGirl account for this email address.',
        '',
        'Open this link to confirm the request. It stops working after 30 days:',
        link,
        '',
        'If it was not you, ignore this email. The account is not deleted from this message alone.',
    ].join('\n');
}
