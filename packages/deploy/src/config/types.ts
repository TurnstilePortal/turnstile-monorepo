import type { Hex } from 'viem';

/**
 * Unified deploy configuration
 */
export interface DeployConfig {
  name: string;
  connection: {
    ethereum: {
      rpc: string;
      chainName: string;
    };
    aztec: {
      node: string;
      pxe: string;
    };
  };
  aztecRollupAddresses?: AztecRollupAddresses;
  deployment: {
    overwrite: boolean;
    tokens: Record<string, TokenConfig>;
  };
  /**
   * Optional setup class name to run before deployment
   * The setup class must be registered with the setupRegistry
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
 * Aztec core rollup contract addresses
 */
export interface AztecRollupAddresses {
  rollupAddress: Hex;
  registryAddress: Hex;
  inboxAddress?: Hex;
  outboxAddress?: Hex;
  sequencerAddress?: Hex;
  [key: string]: Hex | undefined;
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
