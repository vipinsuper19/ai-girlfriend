export type RateLimitRoute =
    | 'login'
    | 'register'
    | 'password-reset'
    | 'messages';

export type RateLimitDimension = {
    max: number;
    windowMs: number;
};

export type RateLimitRouteConfig = {
    ip: RateLimitDimension;
    user: RateLimitDimension;
};

const DEFAULTS: Record<RateLimitRoute, {
    ipMax: number;
    ipWindowSec: number;
    userMax: number;
    userWindowSec: number;
}> = {
    login: {
        ipMax: 20,
        ipWindowSec: 15 * 60,
        userMax: 10,
        userWindowSec: 15 * 60,
    },
    register: {
        ipMax: 10,
        ipWindowSec: 60 * 60,
        userMax: 5,
        userWindowSec: 60 * 60,
    },
    'password-reset': {
        ipMax: 10,
        ipWindowSec: 60 * 60,
        userMax: 5,
        userWindowSec: 60 * 60,
    },
    messages: {
        ipMax: 60,
        ipWindowSec: 60,
        userMax: 30,
        userWindowSec: 60,
    },
};

/**
 * Fixed-window caps. `0` turns that dimension off. A missing or invalid value
 * keeps the default. Windows are seconds in the environment and milliseconds here.
 */
export function rateLimitConfig(
    env: NodeJS.ProcessEnv = process.env,
): Record<RateLimitRoute, RateLimitRouteConfig> {
    const routes = {} as Record<RateLimitRoute, RateLimitRouteConfig>;
    for (const route of Object.keys(DEFAULTS) as RateLimitRoute[]) {
        const prefix = envPrefix(route);
        const defaults = DEFAULTS[route];
        routes[route] = {
            ip: {
                max: intEnv(env[`${prefix}_IP_MAX`], defaults.ipMax),
                windowMs: windowMs(env[`${prefix}_IP_WINDOW_SEC`], defaults.ipWindowSec),
            },
            user: {
                max: intEnv(env[`${prefix}_USER_MAX`], defaults.userMax),
                windowMs: windowMs(env[`${prefix}_USER_WINDOW_SEC`], defaults.userWindowSec),
            },
        };
    }
    return routes;
}

function envPrefix(route: RateLimitRoute): string {
    switch (route) {
        case 'login':
            return 'RATE_LIMIT_LOGIN';
        case 'register':
            return 'RATE_LIMIT_REGISTER';
        case 'password-reset':
            return 'RATE_LIMIT_PASSWORD_RESET';
        case 'messages':
            return 'RATE_LIMIT_MESSAGES';
    }
}

function intEnv(raw: string | undefined, fallback: number): number {
    if (raw == null || raw.trim() === '') return fallback;
    const parsed = Number(raw.trim());
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.floor(parsed);
}

function windowMs(raw: string | undefined, fallbackSec: number): number {
    const seconds = intEnv(raw, fallbackSec);
    if (seconds <= 0) return fallbackSec * 1000;
    return seconds * 1000;
}
