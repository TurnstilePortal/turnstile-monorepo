import type { Hex } from 'viem';

/**
 * Unified deploy configuration
 *
 * This is the main configuration interface for deployment. It includes connection details,
 * Aztec rollup addresses, deployment options, and optional setup configuration.
 */
export interface DeployConfig {
  /** Name of the deployment environment */
  name: string;

  /** Connection details for Ethereum and Aztec networks */
  connection: {
    ethereum: {
      /** Ethereum RPC endpoint (e.g., http://localhost:8545) */
      rpc: string;
      /** Chain name (e.g., 'anvil', 'sepolia', 'mainnet') */
      chainName: string;
    };
    aztec: {
      /** Aztec node endpoint (e.g., http://localhost:8080) */
      node: string;
    };
  };

  /** Deployment options */
  deployment: {
    /** Whether to overwrite existing deployments */
    overwrite: boolean;
    /** Tokens to deploy, where the key is the token symbol */
    tokens: Record<string, TokenConfig>;
  };

  /**
   * Optional setup class name to run before deployment
   * The setup class must be registered with the setupRegistry
   *
   * For sandbox environments, you can use 'SandboxSetup' which will
   * automatically extract the required Aztec rollup addresses.
   */
  setup?: string;
}

/**
 * Token configuration for deployment
 */
export interface TokenConfig {
  name: string;
  symbol: string;
  decimals: number;
}

/**
 * Deployment result
 */
export interface DeploymentResult {
  l1AllowList: Hex;
  l1Portal: Hex;
  aztecTokenContractClassID: `0x${string}`;
  aztecPortal: `0x${string}`;
  aztecShieldGateway: `0x${string}`;
}

/**
 * Token deployment result
 */
export interface TokenDeploymentResult {
  name: string;
  symbol: string;
  decimals: number;
  l1Address: Hex;
  l2Address: Hex;
}
