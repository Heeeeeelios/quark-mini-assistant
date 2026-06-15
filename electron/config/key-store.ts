import { app } from 'electron';
import fs from 'fs';
import path from 'path';

const CONFIG_DIR = app.getPath('userData');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

interface AppConfig {
  dashScopeApiKey?: string;
}

/**
 * Read config from userData/config.json.
 */
function readConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(raw) as AppConfig;
    }
  } catch {
    // Ignore read errors
  }
  return {};
}

/**
 * Write config to userData/config.json.
 */
function writeConfig(config: AppConfig): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch {
    // Ignore write errors
  }
}

/**
 * Get API key with priority:
 * 1. userData/config.json
 * 2. .env file (DASHSCOPE_API_KEY env var)
 * 3. null (fallback to mock)
 */
export function getApiKey(): string | null {
  // Priority 1: userData config
  const config = readConfig();
  if (config.dashScopeApiKey && config.dashScopeApiKey.length > 0) {
    return config.dashScopeApiKey.trim();
  }

  // Priority 2: .env
  const envKey = process.env.DASHSCOPE_API_KEY;
  if (envKey && envKey.length > 0) {
    return envKey.trim();
  }

  // Priority 3: not configured
  return null;
}

/**
 * Save API key to userData/config.json.
 */
export function saveApiKey(key: string): boolean {
  try {
    const config = readConfig();
    config.dashScopeApiKey = key.trim();
    writeConfig(config);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove API key from userData/config.json.
 */
export function removeApiKey(): void {
  const config = readConfig();
  delete config.dashScopeApiKey;
  writeConfig(config);
}
