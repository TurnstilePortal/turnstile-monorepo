import { ErrorCode, createError } from '../errors.js';
import type {
  NetworkConfig,
  TurnstileConfig,
  ConfigSource,
  NetworkName,
  DeploymentData,
  DeploymentDataToken,
} from './types.js';

/**
 * Default network configurations
 */
const DEFAULT_NETWORKS: Partial<Record<NetworkName, NetworkConfig>> = {
  testnet: {
    name: 'testnet',
    description: 'Aztec Testnet Environment',
    l1ChainId: 11155111, // Sepolia
    l2ChainId: 1,
    rpc: {
      l1: 'https://sepolia.infura.io/v3/your-api-key',
      l2: 'https://testnet.aztec.walletmesh.com',
    },
    deployment: {
      l1Portal: '0x0000000000000000000000000000000000000000',
      l1AllowList: '0x0000000000000000000000000000000000000000',
      aztecTokenContractClassID:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      aztecPortal:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      serializedAztecPortalInstance:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      aztecShieldGateway:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      serializedShieldGatewayInstance:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      tokens: {},
    },
  },
  mainnet: {
    name: 'mainnet',
    description: 'Aztec Mainnet Environment',
    l1ChainId: 1, // Ethereum mainnet
    l2ChainId: 1,
    rpc: {
      l1: 'https://mainnet.infura.io/v3/your-api-key',
      l2: 'https://mainnet.aztec.walletmesh.com',
    },
    deployment: {
      l1Portal: '0x0000000000000000000000000000000000000000',
      l1AllowList: '0x0000000000000000000000000000000000000000',
      aztecTokenContractClassID:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      aztecPortal:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      serializedAztecPortalInstance:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      aztecShieldGateway:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      serializedShieldGatewayInstance:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      tokens: {},
    },
  },
  local: {
    name: 'local',
    description: 'Local Development Environment',
    l1ChainId: 31337, // Hardhat default
    l2ChainId: 1,
    rpc: {
      l1: 'http://localhost:8545',
      l2: 'http://localhost:8080',
    },
    deployment: {
      l1Portal: '0x0000000000000000000000000000000000000000',
      l1AllowList: '0x0000000000000000000000000000000000000000',
      aztecTokenContractClassID:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      aztecPortal:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      serializedAztecPortalInstance:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      aztecShieldGateway:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      serializedShieldGatewayInstance:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      tokens: {},
    },
  },
};

/**
 * Configuration cache to avoid repeated network requests
 */
const configCache = new Map<string, TurnstileConfig>();

/**
 * Loads sandbox configuration from the live API endpoint
 * @returns The sandbox network configuration
 */
async function loadSandboxConfig(): Promise<NetworkConfig> {
  try {
    const response = await fetch(
      'https://sandbox.aztec.walletmesh.com/api/v1/turnstile/deployment.json',
    );
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
 * Loads configuration from a static file in the deployments directory
 * @param networkName The network name
 * @returns The network configuration
 */
async function loadStaticConfig(
  networkName: NetworkName,
): Promise<NetworkConfig> {
  // Handle sandbox configuration separately - load from API
  if (networkName === 'sandbox') {
    return loadSandboxConfig();
  }

  try {
    // Try to load from static deployments directory
    const configPath = `./deployments/${networkName}.json`;

    if (typeof window === 'undefined') {
      // Node.js environment
      const { readFileSync } = await import('node:fs');
      const { join } = await import('node:path');
      const { fileURLToPath } = await import('node:url');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = join(__filename, '..');
      const fullPath = join(
        __dirname,
        '..',
        'deployments',
        `${networkName}.json`,
      );

      const data = readFileSync(fullPath, 'utf-8');
      return JSON.parse(data) as NetworkConfig;
    }

    // Browser environment
    const response = await fetch(configPath);
    if (!response.ok) {
      throw new Error(
        `Failed to load config from ${configPath}: ${response.statusText}`,
      );
    }
    const data = await response.json();
    return data as NetworkConfig;
  } catch (error) {
    // Fall back to default configuration
    const defaultConfig = DEFAULT_NETWORKS[networkName];
    if (!defaultConfig) {
      throw createError(
        ErrorCode.CONFIG_MISSING_PARAMETER,
        `No configuration found for network: ${networkName}`,
        { networkName },
      );
    }
    return defaultConfig;
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
 * @param source The configuration source (network name or URL)
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
    // Load from static configuration
    networkConfig = await loadStaticConfig(source);
  } else {
    // Load from URL
    const deploymentData = await loadUrlConfig(source);

    // Create a minimal network config from deployment data
    networkConfig = {
      name: 'custom',
      description: 'Custom network configuration',
      l1ChainId: 1, // Default values - should be overridden
      l2ChainId: 1,
      rpc: {
        l1: 'https://ethereum.rpc',
        l2: 'https://aztec.rpc',
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
 * Checks if a string is a valid network name
 * @param source The source to check
 * @returns True if it's a network name
 */
function isNetworkName(source: ConfigSource): source is NetworkName {
  return ['sandbox', 'testnet', 'mainnet', 'local'].includes(source);
}

/**
 * Gets the default configuration for a network
 * @param networkName The network name
 * @returns The default network configuration
 */
export function getDefaultConfig(networkName: NetworkName): NetworkConfig {
  // Handle sandbox specially since it's loaded dynamically
  if (networkName === 'sandbox') {
    throw createError(
      ErrorCode.CONFIG_MISSING_PARAMETER,
      'Sandbox configuration is loaded dynamically from API and cannot be retrieved as a default configuration',
      { networkName },
    );
  }

  const config = DEFAULT_NETWORKS[networkName];
  if (!config) {
    throw createError(
      ErrorCode.CONFIG_MISSING_PARAMETER,
      `No default configuration found for network: ${networkName}`,
      { networkName },
    );
  }
  return config;
}

/**
 * Clears the configuration cache
 */
export function clearConfigCache(): void {
  configCache.clear();
}
