import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { RoflClient, KeyKind, ROFL_SOCKET_PATH } from '@oasisprotocol/rofl-client';

// Initialize ROFL client (lazy initialization)
let client: RoflClient | null = null;

function getClient(): RoflClient {
  if (!client) {
    // Use default socket path
    client = new RoflClient();
  }
  return client;
}

/**
 * Get the TEE private key from ROFL keygen or fallback to secure storage
 * In Oasis ROFL TEE, keys are obtained via:
 * 1. ROFL keygen service (preferred)
 * 2. Environment variables
 * 3. Secure file system paths
 */
export async function getTeePrivateKey(keyId?: string): Promise<string> {
  // Default key ID for EVM keys
  const KEY_ID = keyId || process.env.KEY_ID || 'evm:base:sepolia';

  // Prefer ROFL keygen when the UNIX socket is present
  if (existsSync(ROFL_SOCKET_PATH)) {
    try {
      console.log(`🔑 Using ROFL keygen for key ID: ${KEY_ID}`);
      const roflClient = getClient();
      const hex = await roflClient.generateKey(KEY_ID, KeyKind.SECP256K1);
      return hex.startsWith('0x') ? hex : `0x${hex}`;
    } catch (error: any) {
      console.error('⚠️  ROFL keygen failed:', error.message);
      // Fall through to other methods
    }
  }

  // Try environment variable
  const envKey = process.env.TEE_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (envKey) {
    console.log('🔑 Using private key from environment variable');
    return envKey.startsWith('0x') ? envKey : `0x${envKey}`;
  }

  // Try reading from secure storage path (common in TEE environments)
  const keyPaths = [
    '/run/secrets/private_key',
    '/run/tee/private_key',
    '/secure/private_key',
    join(process.cwd(), '.tee', 'private_key'),
  ];

  for (const keyPath of keyPaths) {
    try {
      const key = readFileSync(keyPath, 'utf-8').trim();
      console.log(`🔑 Using private key from: ${keyPath}`);
      return key.startsWith('0x') ? key : `0x${key}`;
    } catch (error) {
      // File doesn't exist, try next path
      continue;
    }
  }

  // Explicit local-only fallback for development
  const allowLocal = process.env.ALLOW_LOCAL_DEV === 'true';
  const fallback = process.env.LOCAL_DEV_SK;
  if (allowLocal && fallback && /^0x[0-9a-fA-F]{64}$/.test(fallback)) {
    console.log('⚠️  Using LOCAL_DEV_SK fallback (development only)');
    return fallback;
  }

  throw new Error(
    'TEE private key not found. ROFL keygen socket not found at /run/rofl-appd.sock and no fallback provided. ' +
    'Set TEE_PRIVATE_KEY environment variable, place key in secure storage, or enable local fallback with ALLOW_LOCAL_DEV=true and LOCAL_DEV_SK.'
  );
}

/**
 * Synchronous version of getTeePrivateKey for backward compatibility
 * Note: This cannot use ROFL keygen service (async only)
 */
export function getTeePrivateKeySync(): string {
  // Try environment variable first
  const envKey = process.env.TEE_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (envKey) {
    return envKey.startsWith('0x') ? envKey : `0x${envKey}`;
  }

  // Try reading from secure storage path
  const keyPaths = [
    '/run/secrets/private_key',
    '/run/tee/private_key',
    '/secure/private_key',
    join(process.cwd(), '.tee', 'private_key'),
  ];

  for (const keyPath of keyPaths) {
    try {
      const key = readFileSync(keyPath, 'utf-8').trim();
      return key.startsWith('0x') ? key : `0x${key}`;
    } catch (error) {
      continue;
    }
  }

  // Local dev fallback
  const allowLocal = process.env.ALLOW_LOCAL_DEV === 'true';
  const fallback = process.env.LOCAL_DEV_SK;
  if (allowLocal && fallback && /^0x[0-9a-fA-F]{64}$/.test(fallback)) {
    return fallback;
  }

  throw new Error('TEE private key not found (sync method cannot use ROFL keygen)');
}

/**
 * Get the ROFL application ID
 */
export async function getAppId(): Promise<string> {
  if (!existsSync(ROFL_SOCKET_PATH)) {
    throw new Error('ROFL socket not found');
  }
  const roflClient = getClient();
  return roflClient.getAppId();
}

/**
 * Check if we're running in a TEE environment
 */
export function isTeeEnvironment(): boolean {
  return (
    process.env.TEE_ENABLED === 'true' ||
    process.env.ROFL_APP_ID !== undefined ||
    process.env.TEE_PRIVATE_KEY !== undefined ||
    process.platform === 'linux'
  );
}

