import dotenv from 'dotenv';
import path from 'path';

// __dirname is available in CommonJS output
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Get the DashScope API key from environment.
 * Returns null if not configured.
 */
export function getApiKey(): string | null {
  const key = process.env.DASHSCOPE_API_KEY;
  return key && key.length > 0 ? key.trim() : null;
}

/**
 * Check if the API key is configured.
 */
export function isApiKeyConfigured(): boolean {
  return getApiKey() !== null;
}
