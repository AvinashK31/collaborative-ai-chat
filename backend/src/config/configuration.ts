/*
 * Application configuration loader.
 *
 * This file defines a factory function that assembles configuration
 * values from environment variables.  The structure returned here
 * can be injected via the ConfigService and provides strong typing
 * throughout the application.  All values defined in the
 * validation schema should be surfaced here to avoid direct
 * access to process.env elsewhere in the codebase.
 */

export default () => ({
  /**
   * The port on which the NestJS HTTP server will listen.  Defaults
   * to 9000 if not set.
   */
  port: parseInt(process.env.PORT ?? '9000', 10),
  /**
   * Database connection configuration.  Currently only the Prisma
   * connection URL is surfaced here; additional settings (e.g. for
   * pooling) can be added as required.
   */
  database: {
    url: process.env.DATABASE_URL,
  },
  /**
   * OpenAI configuration.  These values control which model is used
   * for chat and embeddings, as well as token limits and sampling
   * behaviour.  Where appropriate sensible defaults are provided.
   */
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL ?? 'gpt-5-nano',
    temperature: process.env.OPENAI_TEMPERATURE ? Number(process.env.OPENAI_TEMPERATURE) : undefined,
    maxTokens: process.env.OPENAI_MAX_TOKENS ? Number(process.env.OPENAI_MAX_TOKENS) : 500,
  },
  /**
   * Vector database configuration.  The provider can be 'memory'
   * (in‑memory vector store) or 'chroma' (ChromaDB).  Additional
   * providers may be added here as the service evolves.
   */
  vector: {
    provider: process.env.VECTOR_DB_PROVIDER ?? 'memory',
    url: process.env.VECTOR_DB_URL,
    collection: process.env.VECTOR_DB_COLLECTION ?? 'messages',
  },
  /**
   * JSON Web Token (JWT) configuration.  At minimum the secret
   * should be provided; expiry and algorithm can be added if
   * required.
   */
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },
});