/**
 * Config loader for the new unified deploy configuration
 */
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { DeployConfig, TokenConfig } from './types.js';
import { DEV_TOKENS } from '../lib/tokens.js';

const DEFAULT_CONFIG_DIR = path.join(process.cwd(), 'config');

export interface ConfigPaths {
  configFile: string;
  keysFile: string;
  deploymentFile: string;
}

/**
 * Get the paths for an environment's configuration files
 */
export function getConfigPaths(
  env: string,
  configDir: string = DEFAULT_CONFIG_DIR,
): ConfigPaths {
  const envDir = path.join(configDir, env);

  return {
    configFile: path.join(envDir, 'config.json'),
    keysFile: path.join(envDir, 'keys.json'),
    deploymentFile: path.join(envDir, 'deployment.json'),
  };
}

/**
 * Ensure the environment's directory structure exists
 */
export async function ensureConfigDirectory(
  env: string,
  configDir: string = DEFAULT_CONFIG_DIR,
): Promise<void> {
  const envDir = path.join(configDir, env);

  // Create directories if they don't exist
  if (!existsSync(envDir)) {
    await fs.mkdir(envDir, { recursive: true });
  }
}

/**
 * Load the deploy configuration for an environment
 */
export async function loadDeployConfig(
  configPath: string,
): Promise<DeployConfig> {
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  const content = await fs.readFile(configPath, 'utf8');
  const config = JSON.parse(content) as DeployConfig;

  // Apply defaults if needed
  return {
    name: config.name,
    connection: {
      ethereum: config.connection.ethereum,
      aztec: config.connection.aztec,
    },
    deployment: {
      overwrite: config.deployment.overwrite ?? false,
      generateKeysIfMissing: config.deployment.generateKeysIfMissing ?? true,
      tokens: config.deployment.tokens ?? {},
    },
    // Preserve the setup field if it exists
    ...(config.setup ? { setup: config.setup } : {}),
  };
}

/**
 * Create a default config file for an environment
 */
export async function createDefaultConfig(
  configPath: string,
  env: string,
  options: {
    ethereumRpc?: string;
    ethereumChainName?: string;
    aztecNode?: string;
    aztecPxe?: string;
    withTokens?: boolean;
  } = {},
): Promise<void> {
  // Default values based on environment
  const defaults = {
    sandbox: {
      ethereumRpc: 'http://localhost:8545',
      ethereumChainName: 'anvil',
      aztecNode: 'http://localhost:8080',
      aztecPxe: 'http://localhost:8080',
    },
    devnet: {
      ethereumRpc: 'https://devnet.aztec.network:8545',
      ethereumChainName: 'devnet',
      aztecNode: 'https://devnet.aztec.network:8080',
      aztecPxe: 'https://devnet.aztec.network:8080',
    },
    testnet: {
      ethereumRpc: 'https://sepolia.infura.io/v3/your-infura-id',
      ethereumChainName: 'sepolia',
      aztecNode: 'https://testnet.aztec.network:8080',
      aztecPxe: 'https://testnet.aztec.network:8080',
    },
  }[env] || {
    ethereumRpc: 'http://localhost:8545',
    ethereumChainName: 'anvil',
    aztecNode: 'http://localhost:8080',
    aztecPxe: 'http://localhost:8080',
  };

  const tokens: Record<string, TokenConfig> = {};
  if (options.withTokens) {
    // Use a subset of tokens for example
    for (const [symbol, config] of Object.entries(DEV_TOKENS).filter(
      ([symbol]) => ['DAI', 'USDC', 'WETH'].includes(symbol),
    )) {
      tokens[symbol] = config;
    }
  }

  const config: DeployConfig = {
    name: `${env.charAt(0).toUpperCase() + env.slice(1)} Environment`,
    connection: {
      ethereum: {
        rpc: options.ethereumRpc || defaults.ethereumRpc,
        chainName: options.ethereumChainName || defaults.ethereumChainName,
      },
      aztec: {
        node: options.aztecNode || defaults.aztecNode,
        pxe: options.aztecPxe || defaults.aztecPxe,
      },
    },
    deployment: {
      overwrite: false,
      generateKeysIfMissing: true,
      tokens,
    },
  };

  // Add setup for sandbox environment
  if (env === 'sandbox') {
    config.setup = 'SandboxSetup';
  }

  // Create directory if it doesn't exist
  const dir = path.dirname(configPath);
  if (!existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }

  // Write the config file
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}
