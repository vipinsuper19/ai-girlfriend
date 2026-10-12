export const API_PREFIX = 'api';
export const API_VERSION = '1';

export const API_BASE_PATH = `${API_PREFIX}/v${API_VERSION}`;

/** Routes Render and the Play Store open at the site root, not under /api/v1. */
export const UNPREFIXED_ROUTES = [
    'health',
    'privacy',
    'account-deletion',
    'account-deletion/confirm',
] as const;
