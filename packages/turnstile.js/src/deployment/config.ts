import { createError, ErrorCode } from '../errors.js';
import type {
  ConfigSource,
  DeploymentData,
  DeploymentDataToken,
  NetworkConfig,
  TurnstileConfig,
} from './types.js';

/**
 * Configuration cache to avoid repeated network requests
 */
const configCache = new Map<string, TurnstileConfig>();

/**
 * Checks if a source string is a URL
 * @param source The source to check
 * @returns True if it's a URL
 */
function isUrl(source: string): boolean {
  return source.startsWith('http://') || source.startsWith('https://');
}

/**
 * Loads configuration from a local file
 * @param filePath The file path to load configuration from
 * @returns The deployment data
 */
async function loadFileConfig(filePath: string): Promise<DeploymentData> {
  try {
    if (typeof window !== 'undefined') {
      // Browser environment - can't access local files directly
      throw new Error(
        'Local file access is not supported in browser environment',
      );
    }

    // Node.js environment
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');

    // Resolve the path relative to the current working directory
    const fullPath = resolve(filePath);
    const data = readFileSync(fullPath, 'utf-8');
    return JSON.parse(data) as DeploymentData;
  } catch (error) {
    throw createError(
      ErrorCode.CONFIG_INVALID_PARAMETER,
      `Failed to load configuration from file: ${filePath}`,
      { filePath },
      error,
    );
  }
}

/**
 * Loads configuration from a URL
 * @param url The URL to load configuration from
 * @returns The deployment data
 */
async function loadUrlConfig(url: string): Promise<DeploymentData> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch config from ${url}: ${response.statusText}`,
      );
    }
    const data = await response.json();
    return data as DeploymentData;
  } catch (error) {
    throw createError(
      ErrorCode.CONFIG_INVALID_PARAMETER,
      `Failed to load configuration from URL: ${url}`,
      { url },
      error,
    );
  }
}

/**
 * Loads a Turnstile configuration from various sources
 * @param source The configuration source (URL or file path)
 * @param customTokens Optional custom token configurations
 * @returns The Turnstile configuration
 */
export async function loadConfig(
  source: ConfigSource,
  customTokens?: Record<string, DeploymentDataToken>,
): Promise<TurnstileConfig> {
  // Check cache first
  const cacheKey = `${source}-${JSON.stringify(customTokens || {})}`;
  const cachedConfig = configCache.get(cacheKey);
  if (cachedConfig) {
    return cachedConfig;
  }

  let deploymentData: DeploymentData;

  if (isUrl(source)) {
    // Load from URL
    deploymentData = await loadUrlConfig(source);
  } else {
    // Load from file path
    deploymentData = await loadFileConfig(source);
  }

  // Create a network config from deployment data
  // Since we don't have predefined networks, we'll create a generic one
  const networkConfig: NetworkConfig = {
    name: 'custom',
    description: `Configuration loaded from ${isUrl(source) ? 'URL' : 'file'}: ${source}`,
    l1ChainId: 1, // Default values - should be overridden via RPC config or other means
    l2ChainId: 1,
    rpc: {
      l1: 'http://localhost:8545', // Default values - should be overridden
      l2: 'http://localhost:8080',
    },
    deployment: deploymentData,
  };

  const config: TurnstileConfig = {
    network: networkConfig,
    customTokens,
  };

  // Cache the configuration
  configCache.set(cacheKey, config);

  return config;
}

/**
 * Clears the configuration cache
 */
export function clearConfigCache(): void {
  configCache.clear();
}
