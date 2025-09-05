import { AztecAddress } from '@aztec/aztec.js';
import { SerializableContractInstance } from '@aztec/stdlib/contract';
import type { L1Client, L2Client } from '@turnstile-portal/turnstile.js';
import type { TokenDeploymentResult } from '../config/types.js';

// Import the existing token deployment functions
import { deployL1DevToken, deployL2DevToken } from './deploy/devTokens.js';

// Standard token configurations
export const DEV_TOKENS = {
  DAI: { name: 'DAI', symbol: 'DAI', decimals: 18 },
  USDC: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  USDT: { name: 'Tether USD', symbol: 'USDT', decimals: 6 },
  WETH: { name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
  AZT: { name: 'Aztec Token', symbol: 'AZT', decimals: 18 },
  TT1: { name: 'Test Token 1', symbol: 'TT1', decimals: 18 },
  TT2: { name: 'Test Token 2', symbol: 'TT2', decimals: 18 },
  TT3: { name: 'Test Token 3', symbol: 'TT3', decimals: 18 },
  TT4: { name: 'Test Token 4', symbol: 'TT4', decimals: 18 },
  TT5: { name: 'Test Token 5', symbol: 'TT5', decimals: 18 },
};

export interface TokenConfig {
  name: string;
  symbol: string;
  decimals: number;
}

/**
 * Deploy a token to both L1 and L2
 */
export async function deployToken(
  l1Client: L1Client,
  l2Client: L2Client,
  aztecPortalAddress: string,
  config: TokenConfig,
): Promise<TokenDeploymentResult> {
  console.log(`Deploying ${config.name} (${config.symbol})...`);

  // Deploy L1 token
  const l1TokenAddress = await deployL1DevToken(l1Client, config.name, config.symbol, config.decimals);

  // Deploy L2 token
  const l2Token = await deployL2DevToken(
    l2Client,
    AztecAddress.fromString(aztecPortalAddress),
    config.name,
    config.symbol,
    config.decimals,
  );

  const serializableL2TokenInstance = new SerializableContractInstance(l2Token.getContract().instance);

  return {
    name: config.name,
    symbol: config.symbol,
    decimals: config.decimals,
    l1Address: l1TokenAddress,
    l2Address: l2Token.getAddress().toString(),
    serializedL2TokenInstance: `0x${serializableL2TokenInstance.toBuffer().toString('hex')}`,
  };
}

/**
 * Deploy multiple tokens to both L1 and L2
 */
export async function deployTokens(
  l1Client: L1Client,
  l2Client: L2Client,
  aztecPortalAddress: string,
  tokens: Record<string, TokenConfig> = DEV_TOKENS,
): Promise<Record<string, TokenDeploymentResult>> {
  const result: Record<string, TokenDeploymentResult> = {};

  for (const [symbol, config] of Object.entries(tokens)) {
    result[symbol] = await deployToken(l1Client, l2Client, aztecPortalAddress, config);
  }

  return result;
}
