export const DEFAULT_ACCESS_TOKEN_TTL = '15m';

/**
 * Login and refresh must share one fallback. A 30-day login token next to a
 * 15-minute refresh token made the same env var mean two lifetimes.
 */
export function accessTokenExpiresIn(
    env: NodeJS.ProcessEnv = process.env,
): string {
    const configured = env['JWT_ACCESS_EXPIRES_IN']?.trim();
    return configured ? configured : DEFAULT_ACCESS_TOKEN_TTL;
}
