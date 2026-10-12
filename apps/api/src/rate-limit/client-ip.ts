/**
 * Uses Express `req.ip`, which honors `trust proxy`. Do not read
 * X-Forwarded-For here: a client can spoof that header, and Render already
 * appends the real address for the one trusted hop.
 */
export function clientIp(request: {
    ip?: string;
    socket?: { remoteAddress?: string | null };
}): string {
    const ip = normalize(request.ip);
    if (ip) return ip;
    return normalize(request.socket?.remoteAddress) ?? 'unknown';
}

function normalize(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.replace(/^::ffff:/, '').trim();
    return trimmed.length > 0 ? trimmed : null;
}
