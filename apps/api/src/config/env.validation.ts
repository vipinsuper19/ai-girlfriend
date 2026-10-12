import Joi from 'joi';

/**
 * Credentials a production process must have. Set these in the Render
 * secret manager (dashboard env vars). Do not commit the values.
 * S3 keys are required because production storage is a private Supabase bucket.
 */
export const REQUIRED_PRODUCTION_SECRETS = [
    'DATABASE_URL',
    'DIRECT_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'GEMINI_API_KEY',
    'SMTP_URL',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
] as const;

/**
 * Required in production and different per deploy, but not credentials.
 * Keep them out of git the same way (`sync: false` on the service).
 */
export const REQUIRED_PRODUCTION_SETTINGS = [
    'CORS_ORIGIN',
    'APP_URL',
    'MAIL_FROM',
    'S3_ENDPOINT',
    'S3_REGION',
    'S3_BUCKET',
] as const;

const OFF = new Set(['0', 'false', 'no', 'off']);

const postgresUrl = Joi.string().pattern(/^postgres(ql)?:\/\//);
const httpUrl = Joi.string().uri({ scheme: ['http', 'https'] });
const duration = Joi.string().pattern(/^\d+[smhd]$/);
const count = Joi.number().integer().min(0);
const windowSec = Joi.number().integer().min(1);
const limitOrUnlimited = Joi.alternatives().try(
    Joi.number().integer().min(0),
    Joi.string().valid('unlimited'),
);

function requiredInProduction<T extends Joi.AnySchema>(schema: T) {
    return schema.when('NODE_ENV', {
        is: 'production',
        then: schema.required(),
        otherwise: schema.optional(),
    });
}

function requiredForS3<T extends Joi.AnySchema>(schema: T) {
    return schema.when('NODE_ENV', {
        is: 'production',
        then: schema.required(),
        otherwise: schema.when('STORAGE_DRIVER', {
            is: 's3',
            then: schema.required(),
            otherwise: schema.optional(),
        }),
    });
}

const rateLimitKeys = [
    'RATE_LIMIT_LOGIN_IP_MAX',
    'RATE_LIMIT_LOGIN_USER_MAX',
    'RATE_LIMIT_REGISTER_IP_MAX',
    'RATE_LIMIT_REGISTER_USER_MAX',
    'RATE_LIMIT_PASSWORD_RESET_IP_MAX',
    'RATE_LIMIT_PASSWORD_RESET_USER_MAX',
    'RATE_LIMIT_MESSAGES_IP_MAX',
    'RATE_LIMIT_MESSAGES_USER_MAX',
] as const;

const rateLimitWindows = [
    'RATE_LIMIT_LOGIN_IP_WINDOW_SEC',
    'RATE_LIMIT_LOGIN_USER_WINDOW_SEC',
    'RATE_LIMIT_REGISTER_IP_WINDOW_SEC',
    'RATE_LIMIT_REGISTER_USER_WINDOW_SEC',
    'RATE_LIMIT_PASSWORD_RESET_IP_WINDOW_SEC',
    'RATE_LIMIT_PASSWORD_RESET_USER_WINDOW_SEC',
    'RATE_LIMIT_MESSAGES_IP_WINDOW_SEC',
    'RATE_LIMIT_MESSAGES_USER_WINDOW_SEC',
] as const;

const rateLimits = Object.fromEntries([
    ...rateLimitKeys.map((key) => [key, count.optional()]),
    ...rateLimitWindows.map((key) => [key, windowSec.optional()]),
]);

export const envValidationSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
    PORT: Joi.number().port().default(3001),
    TRUST_PROXY_HOPS: count.optional(),

    DATABASE_URL: postgresUrl.required(),
    DIRECT_URL: requiredInProduction(postgresUrl),
    REDIS_URL: Joi.string().optional(),

    JWT_ACCESS_SECRET: Joi.string().min(32).required(),
    JWT_REFRESH_SECRET: Joi.string().min(32).required(),
    JWT_RESET_SECRET: Joi.string().min(32).optional(),
    JWT_ACCESS_EXPIRES_IN: duration.optional(),
    JWT_REFRESH_EXPIRES_IN: duration.optional(),

    CORS_ORIGIN: Joi.string().min(1).required(),
    APP_URL: requiredInProduction(Joi.string().uri({ scheme: ['https'] })),

    GEMINI_API_KEY: requiredInProduction(Joi.string().min(1)),
    GEMINI_CHAT_MODEL: Joi.string().optional(),
    GEMINI_IMAGE_MODEL: Joi.string().optional(),
    GEMINI_STT_MODEL: Joi.string().optional(),
    GEMINI_TTS_MODEL: Joi.string().optional(),
    OPENAI_API_KEY: Joi.string().optional(),
    OPENAI_CHAT_MODEL: Joi.string().optional(),

    MODERATION_ENABLED: Joi.string().optional(),
    MODERATION_PROVIDER: Joi.string().valid('auto', 'openai', 'gemini', 'local').optional(),
    MODERATION_MODEL: Joi.string().optional(),
    MODERATION_FAIL_CLOSED: Joi.string().optional(),
    CRISIS_HELPLINE_IN_NAME: Joi.string().optional(),
    CRISIS_HELPLINE_IN_CONTACT: Joi.string().optional(),
    CRISIS_HELPLINE_IN_DETAIL: Joi.string().optional(),
    CRISIS_HELPLINE_INTL_NAME: Joi.string().optional(),
    CRISIS_HELPLINE_INTL_CONTACT: Joi.string().optional(),
    CRISIS_HELPLINE_INTL_DETAIL: Joi.string().optional(),

    FREE_TIER_LLM_PERIOD: Joi.string().valid('day', 'month', 'monthly').optional(),
    FREE_TIER_LLM_MESSAGE_LIMIT: limitOrUnlimited.optional(),
    FREE_TIER_LLM_TOKEN_LIMIT: limitOrUnlimited.optional(),
    ...rateLimits,

    STORAGE_DRIVER: Joi.string().valid('local', 's3').default('local'),
    STORAGE_SIGNED_URL_TTL_SECONDS: Joi.number().integer().min(60).max(86_400).optional(),
    STORAGE_LOCAL_DIR: Joi.string().custom((value, helpers) => {
        if (String(value).split(/[/\\]/).includes('..')) {
            return helpers.error('any.invalid');
        }
        return value;
    }).optional(),
    STORAGE_SIGNING_SECRET: Joi.string().min(16).optional(),
    S3_ENDPOINT: requiredForS3(httpUrl),
    S3_REGION: requiredForS3(Joi.string().min(1)),
    S3_BUCKET: requiredForS3(Joi.string().pattern(/^[A-Za-z0-9][A-Za-z0-9._-]{1,62}$/)),
    S3_ACCESS_KEY_ID: requiredForS3(Joi.string().min(1)),
    S3_SECRET_ACCESS_KEY: requiredForS3(Joi.string().min(1)),
    S3_FORCE_PATH_STYLE: Joi.boolean().optional(),

    SMTP_URL: requiredInProduction(Joi.string().pattern(/^smtps?:\/\//)),
    MAIL_FROM: requiredInProduction(Joi.string().email()),

    GOOGLE_CLIENT_IDS: Joi.string().optional(),
    FIREBASE_PROJECT_ID: Joi.string().optional(),
    FIREBASE_SERVICE_ACCOUNT_JSON: Joi.string().optional(),
    GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: Joi.string().optional(),
    GOOGLE_PLAY_PACKAGE_NAME: Joi.string().optional(),
    GOOGLE_PLAY_PRODUCTS: Joi.string().optional(),
}).unknown(true);

export type EnvInput = Record<string, string | undefined>;

function normalize(env: EnvInput): Record<string, string> {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
        if (typeof value !== 'string') continue;
        const trimmed = value.trim();
        if (trimmed !== '') normalized[key] = trimmed;
    }
    return normalized;
}

/**
 * Throws before the server listens when the environment cannot boot safely.
 * Production is strict. Development and test only require the database,
 * the two JWT secrets, and CORS_ORIGIN.
 */
export function validateEnv(env: EnvInput = process.env): Record<string, unknown> {
    const { error, value } = envValidationSchema.validate(normalize(env), {
        abortEarly: false,
        allowUnknown: true,
        convert: true,
    });
    if (error) {
        const details = error.details.map((detail) => detail.message).join('\n');
        throw new Error(`Refusing to start. Invalid environment:\n${details}`);
    }
    assertProductionPolicy(value as Record<string, unknown>);
    return value;
}

function assertProductionPolicy(value: Record<string, unknown>): void {
    if (value.NODE_ENV !== 'production') return;

    const problems: string[] = [];
    if (value.STORAGE_DRIVER !== 's3') {
        problems.push('STORAGE_DRIVER must be s3 in production');
    }
    const moderation = String(value.MODERATION_ENABLED ?? '').toLowerCase();
    if (OFF.has(moderation)) {
        problems.push('MODERATION_ENABLED=false is not allowed when NODE_ENV=production');
    }
    if (String(value.MODERATION_PROVIDER ?? '').toLowerCase() === 'local') {
        problems.push('MODERATION_PROVIDER=local is not allowed when NODE_ENV=production');
    }
    if (problems.length > 0) {
        throw new Error(`Refusing to start. Invalid environment:\n${problems.join('\n')}`);
    }
}
