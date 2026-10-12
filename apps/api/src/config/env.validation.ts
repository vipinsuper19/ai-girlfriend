import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  PORT: Joi.number()
    .port()
    .default(3001),

  DATABASE_URL: Joi.string()
    .required(),

  REDIS_URL: Joi.string()
    .optional(),

  JWT_ACCESS_SECRET: Joi.string()
    .min(32)
    .required(),

  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .required(),

  JWT_ACCESS_EXPIRATION: Joi.string()
    .default('15m'),

  JWT_REFRESH_EXPIRATION: Joi.string()
    .default('30d'),

  CORS_ORIGIN: Joi.string()
    .required(),

  STORAGE_DRIVER: Joi.string()
    .valid('local', 's3')
    .default('local'),

  STORAGE_SIGNED_URL_TTL_SECONDS: Joi.number()
    .integer()
    .min(60)
    .max(86400)
    .default(3600),

  STORAGE_LOCAL_DIR: Joi.string()
    .optional(),

  STORAGE_SIGNING_SECRET: Joi.string()
    .min(16)
    .optional(),

  // Required together when STORAGE_DRIVER=s3. createObjectStorage enforces that.
  S3_ENDPOINT: Joi.string()
    .uri()
    .optional(),

  S3_REGION: Joi.string()
    .optional(),

  S3_BUCKET: Joi.string()
    .optional(),

  S3_ACCESS_KEY_ID: Joi.string()
    .optional(),

  S3_SECRET_ACCESS_KEY: Joi.string()
    .optional(),

  S3_FORCE_PATH_STYLE: Joi.boolean()
    .optional(),
});