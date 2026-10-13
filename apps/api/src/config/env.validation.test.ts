import assert from 'node:assert/strict';
import test from 'node:test';

import {
    REQUIRED_PRODUCTION_SECRETS,
    REQUIRED_PRODUCTION_SETTINGS,
    validateEnv,
} from './env.validation.js';

const DEV = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/ai_girlfriend',
    JWT_ACCESS_SECRET: 'dev-access-secret-0123456789abcdef',
    JWT_REFRESH_SECRET: 'dev-refresh-secret-0123456789abcdef',
    CORS_ORIGIN: 'http://localhost:3000',
};

const PRODUCTION = {
    ...DEV,
    NODE_ENV: 'production',
    DIRECT_URL: 'postgresql://postgres:postgres@db.example.com:5432/ai_girlfriend',
    APP_URL: 'https://app.example.com',
    GEMINI_API_KEY: 'gemini-key',
    SMTP_URL: 'smtps://mailer:secret@smtp.example.com:465',
    MAIL_FROM: 'no-reply@example.com',
    STORAGE_DRIVER: 's3',
    S3_ENDPOINT: 'https://project.storage.supabase.co/storage/v1/s3',
    S3_REGION: 'ap-southeast-1',
    S3_BUCKET: 'media',
    S3_ACCESS_KEY_ID: 'access-key',
    S3_SECRET_ACCESS_KEY: 'secret-key',
    MODERATION_ENABLED: 'true',
    MODERATION_PROVIDER: 'auto',
    FREE_TIER_LLM_PERIOD: 'day',
    FREE_TIER_LLM_MESSAGE_LIMIT: '40',
    FREE_TIER_LLM_TOKEN_LIMIT: 'unlimited',
    RATE_LIMIT_LOGIN_IP_MAX: '20',
    RATE_LIMIT_MESSAGES_USER_WINDOW_SEC: '60',
    RENDER_SERVICE_ID: 'srv-test',
};

test('development boots with the database, JWT secrets, and CORS', () => {
    const value = validateEnv(DEV);
    assert.equal(value.NODE_ENV, 'development');
    assert.equal(value.STORAGE_DRIVER, 'local');
    assert.equal(value.PORT, 3001);
});

test('a short JWT secret is rejected in every environment', () => {
    assert.throws(
        () => validateEnv({ ...DEV, JWT_ACCESS_SECRET: 'too-short' }),
        /JWT_ACCESS_SECRET/,
    );
});

test('production fails fast on each missing secret and setting', () => {
    for (const key of [...REQUIRED_PRODUCTION_SECRETS, ...REQUIRED_PRODUCTION_SETTINGS]) {
        const env = { ...PRODUCTION };
        delete env[key as keyof typeof env];
        assert.throws(() => validateEnv(env), new RegExp(key), key);
    }
});

test('production accepts a complete configuration and ignores platform extras', () => {
    const value = validateEnv(PRODUCTION);
    assert.equal(value.STORAGE_DRIVER, 's3');
    assert.equal(value.FREE_TIER_LLM_TOKEN_LIMIT, 'unlimited');
    assert.equal(value.RATE_LIMIT_LOGIN_IP_MAX, 20);
});

test('production refuses to disable moderation or store files on local disk', () => {
    assert.throws(
        () => validateEnv({ ...PRODUCTION, MODERATION_ENABLED: 'false' }),
        /MODERATION_ENABLED=false/,
    );
    assert.throws(
        () => validateEnv({ ...PRODUCTION, MODERATION_PROVIDER: 'local' }),
        /MODERATION_PROVIDER=local/,
    );
    assert.throws(
        () => validateEnv({ ...PRODUCTION, STORAGE_DRIVER: 'local' }),
        /STORAGE_DRIVER must be s3/,
    );
    assert.throws(
        () => validateEnv({ ...PRODUCTION, MODERATION_PROVIDER: 'stub' }),
        /MODERATION_PROVIDER=stub/,
    );
    const allowed = validateEnv({
        ...PRODUCTION,
        MODERATION_PROVIDER: 'stub',
        MODERATION_STUB_ALLOWED: 'true',
    });
    assert.equal(allowed.MODERATION_PROVIDER, 'stub');
});

test('s3 storage requires its credentials outside production too', () => {
    assert.throws(
        () => validateEnv({ ...DEV, STORAGE_DRIVER: 's3' }),
        /S3_SECRET_ACCESS_KEY/,
    );
});

test('rate-limit and free-tier overrides must be in range', () => {
    assert.throws(
        () => validateEnv({ ...DEV, RATE_LIMIT_LOGIN_IP_MAX: '-1' }),
        /RATE_LIMIT_LOGIN_IP_MAX/,
    );
    assert.throws(
        () => validateEnv({ ...DEV, FREE_TIER_LLM_PERIOD: 'week' }),
        /FREE_TIER_LLM_PERIOD/,
    );
    assert.throws(
        () => validateEnv({ ...DEV, STORAGE_LOCAL_DIR: '../secrets' }),
        /STORAGE_LOCAL_DIR/,
    );
});
