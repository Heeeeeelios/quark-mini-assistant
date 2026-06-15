import dotenv from 'dotenv';
import path from 'path';

// __dirname is available in CommonJS output
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Re-export from key-store (which handles priority: userData/config.json > .env > null)
export { getApiKey } from './key-store';

/**
 * Check if the API key is configured (from any source).
 */
export function isApiKeyConfigured(): boolean {
  const { getApiKey } = require('./key-store');
  return getApiKey() !== null;
}
