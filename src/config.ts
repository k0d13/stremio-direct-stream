/**
 * Runtime configuration, read from the environment.
 *
 * Bun auto-loads `.env` files, so no dotenv dependency is needed. Required
 * values fail fast at startup rather than surfacing as confusing errors later.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  /** TMDB v3 API key (the one that goes in the `api_key` query param). */
  tmdbApiKey: required("TMDB_API_KEY"),
};
