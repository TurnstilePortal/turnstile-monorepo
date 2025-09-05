import { createError, ErrorCode } from '../errors.js';
import type {
  ConfigSource,
  DeploymentData,
  DeploymentDataToken,
  NetworkConfig,
  NetworkName,
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
 * Checks if a source string is a recognized network name
 * @param source The source to check
 * @returns True if it's a network name
 */
function isNetworkName(source: ConfigSource): source is NetworkName {
  return ['sandbox', 'testnet', 'mainnet', 'local'].includes(source as string);
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
      throw new Error('Local file access is not supported in browser environment');
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
      throw new Error(`Failed to fetch config from ${url}: ${response.statusText}`);
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
 * Loads sandbox configuration from the live API endpoint
 * @returns The sandbox network configuration
 */
async function loadSandboxConfig(): Promise<NetworkConfig> {
  try {
    const response = await fetch('https://sandbox.aztec.walletmesh.com/api/v1/turnstile/deployment.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch sandbox config: ${response.statusText}`);
    }

    const deploymentData = (await response.json()) as DeploymentData;

    return {
      name: 'sandbox',
      description: 'Aztec Sandbox Environment',
      l1ChainId: 11155111, // Sepolia
      l2ChainId: 1,
      rpc: {
        l1: 'https://sandbox.ethereum.walletmesh.com/api/v1/public',
        l2: 'https://sandbox.aztec.walletmesh.com/api/v1/public',
      },
      deployment: deploymentData,
    };
  } catch (error) {
    throw createError(
      ErrorCode.CONFIG_INVALID_PARAMETER,
      'Failed to load sandbox configuration from API',
      {
        url: 'https://sandbox.aztec.walletmesh.com/api/v1/turnstile/deployment.json',
      },
      error,
    );
  }
}

/**
 * Loads a predefined network configuration
 * @param networkName The network name to load
 * @returns The network configuration
 */
async function loadNetworkConfig(networkName: NetworkName): Promise<NetworkConfig> {
  switch (networkName) {
    case 'sandbox':
      return loadSandboxConfig();
    case 'testnet':
      throw createError(
        ErrorCode.CONFIG_MISSING_PARAMETER,
        'Testnet environment is not yet available. Use a URL or file path instead.',
        { networkName },
      );
    case 'mainnet':
      throw createError(
        ErrorCode.CONFIG_MISSING_PARAMETER,
        'Mainnet environment is not yet available. Use a URL or file path instead.',
        { networkName },
      );
    case 'local':
      throw createError(
        ErrorCode.CONFIG_MISSING_PARAMETER,
        'Local environment is not yet available. Use a URL or file path instead.',
        { networkName },
      );
    default:
      throw createError(
        ErrorCode.CONFIG_INVALID_PARAMETER,
        `Unknown network name: ${networkName}. Supported networks: sandbox, testnet, mainnet, local`,
        { networkName },
      );
  }
}

/**
 * Loads a Turnstile configuration from various sources
 * @param source The configuration source (network name, URL, or file path)
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

  let networkConfig: NetworkConfig;

  if (isNetworkName(source)) {
    // Load from predefined network configuration
    networkConfig = await loadNetworkConfig(source);
  } else if (isUrl(source)) {
    // Load from URL
    const deploymentData = await loadUrlConfig(source);
    networkConfig = {
      name: 'custom',
      description: `Configuration loaded from URL: ${source}`,
      l1ChainId: 1, // Default values - should be overridden via RPC config or other means
      l2ChainId: 1,
      rpc: {
        l1: 'http://localhost:8545', // Default values - should be overridden
        l2: 'http://localhost:8080',
      },
      deployment: deploymentData,
    };
  } else {
    // Load from file path
    const deploymentData = await loadFileConfig(source);
    networkConfig = {
      name: 'custom',
      description: `Configuration loaded from file: ${source}`,
      l1ChainId: 1, // Default values - should be overridden via RPC config or other means
      l2ChainId: 1,
      rpc: {
        l1: 'http://localhost:8545', // Default values - should be overridden
        l2: 'http://localhost:8080',
      },
      deployment: deploymentData,
    };
  }

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
