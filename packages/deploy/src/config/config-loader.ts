/**
 * Config loader for the new unified deploy configuration
 */
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { DEV_TOKENS } from '../lib/tokens.js';
import type { DeployConfig, TokenConfig } from './types.js';

const DEFAULT_CONFIG_DIR = path.join(process.cwd(), 'config');

export interface ConfigPaths {
  configFile: string;
  keysFile: string;
  deploymentFile: string;
}

/**
 * Get the paths for configuration files in a directory
 */
export function getConfigPaths(
  configDir: string = DEFAULT_CONFIG_DIR,
): ConfigPaths {
  return {
    configFile: path.join(configDir, 'config.json'),
    keysFile: path.join(configDir, 'keys.json'),
    deploymentFile: path.join(configDir, 'deployment.json'),
  };
}

/**
 * Ensure the config directory exists
 */
export async function ensureConfigDirectory(
  configDir: string = DEFAULT_CONFIG_DIR,
): Promise<void> {
  // Create directory if it doesn't exist
  if (!existsSync(configDir)) {
    await fs.mkdir(configDir, { recursive: true });
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

  // Validate required properties
  if (!config.name) throw new Error('Missing "name" in config');
  if (!config.connection) throw new Error('Missing "connection" in config');
  if (!config.connection.ethereum)
    throw new Error('Missing "connection.ethereum" in config');
  if (!config.connection.aztec)
    throw new Error('Missing "connection.aztec" in config');
  if (!config.deployment) throw new Error('Missing "deployment" in config');

  // Apply defaults but preserve all other properties from the original config
  return {
    ...config,
    deployment: {
      ...config.deployment,
      overwrite: config.deployment.overwrite ?? false,
      tokens: config.deployment.tokens ?? {},
    },
  };
}

/**
 * Create a default config file
 */
export async function createDefaultConfig(
  configPath: string,
  options: {
    name?: string;
    ethereumRpc?: string;
    ethereumChainName?: string;
    aztecNode?: string;
    withTokens?: boolean;
    setup?: string;
  } = {},
): Promise<void> {
  // Default values
  const defaults = {
    ethereumRpc: 'http://localhost:8545',
    ethereumChainName: 'anvil',
    aztecNode: 'http://localhost:8080',
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
    name: options.name || 'Default Environment',
    connection: {
      ethereum: {
        rpc: options.ethereumRpc || defaults.ethereumRpc,
        chainName: options.ethereumChainName || defaults.ethereumChainName,
      },
      aztec: {
        node: options.aztecNode || defaults.aztecNode,
      },
    },
    deployment: {
      overwrite: false,
      tokens,
    },
  };

  // Add setup if provided
  if (options.setup) {
    config.setup = options.setup;
  }

  // Create directory if it doesn't exist
  const dir = path.dirname(configPath);
  if (!existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }

  // Write the config file
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}
