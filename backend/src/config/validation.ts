/*
 * Environment validation schema.
 *
 * Joi is used to validate and coerce environment variables at
 * application start.  Required variables must be present and have
 * the correct type; optional variables may have sensible defaults.
 */

import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Database connection
  DATABASE_URL: Joi.string().uri().required(),
  // OpenAI configuration
  OPENAI_API_KEY: Joi.string().required(),
  OPENAI_MODEL: Joi.string().default('gpt-5-nano'),
  OPENAI_TEMPERATURE: Joi.number().optional(),
  OPENAI_MAX_TOKENS: Joi.number().default(500),
  // Vector store configuration
  VECTOR_DB_PROVIDER: Joi.string().valid('memory', 'chroma').default('memory'),
  VECTOR_DB_URL: Joi.string().uri().optional(),
  VECTOR_DB_COLLECTION: Joi.string().default('messages'),
  // JWT configuration
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().optional(),
  // Server port
  PORT: Joi.number().default(9000),
});