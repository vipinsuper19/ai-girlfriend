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
    .required()
});