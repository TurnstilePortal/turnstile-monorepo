import type { Hex } from 'viem';
import type { AztecAddress, EthAddress } from '@aztec/aztec.js';

/**
 * Token information for deployment configuration
 */
export interface DeploymentDataToken {
  name: string;
  symbol: string;
  decimals: number;
  l2Address: Hex;
  l1Address: Hex;
  serializedL2TokenInstance: Hex;
}

/**
 * Core deployment data containing contract addresses and instances
 */
export interface DeploymentData {
  // These are the addresses of the contracts we deploy.
  l1Portal: Hex;
  l1AllowList: Hex;
  aztecTokenContractClassID: Hex;
  aztecPortal: Hex;
  serializedAztecPortalInstance: Hex;
  aztecShieldGateway: Hex;
  serializedShieldGatewayInstance: Hex;

  // This is intended for use with dev deployments where we're deploying
  // the tokens ourselves.
  tokens: Record<string, DeploymentDataToken>;
}

/**
 * Network configuration for different environments
 */
export interface NetworkConfig {
  /** Network name (e.g., 'sandbox', 'testnet', 'mainnet') */
  name: string;
  /** Network description */
  description?: string;
  /** L1 chain ID */
  l1ChainId: number;
  /** L2 chain ID */
  l2ChainId: number;
  /** RPC endpoints */
  rpc: {
    l1: string;
    l2: string;
  };
  /** Deployment data for this network */
  deployment: DeploymentData;
}

/**
 * Configuration for a specific network environment
 */
export interface TurnstileConfig {
  /** Network configuration */
  network: NetworkConfig;
  /** Optional custom token configurations */
  customTokens?: Record<string, DeploymentDataToken>;
}

/**
 * Supported network names
 */
export type NetworkName = 'sandbox' | 'testnet' | 'mainnet' | 'local';

/**
 * Configuration source type
 */
export type ConfigSource = NetworkName | string; // NetworkName or URL
