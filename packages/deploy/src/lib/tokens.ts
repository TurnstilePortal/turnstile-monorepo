import { AztecAddress, TxStatus } from '@aztec/aztec.js';
import { SerializableContractInstance } from '@aztec/stdlib/contract';
import type { L1Client, L2Client } from '@turnstile-portal/turnstile.js';
import { ContractBatchBuilder, L2Token } from '@turnstile-portal/turnstile.js';
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

/**
 * Deploy multiple L2 tokens in a single batch transaction
 * This optimized version reduces the number of L2 transactions from N to 1
 */
export async function batchDeployL2Tokens(
  l2Client: L2Client,
  aztecPortalAddress: AztecAddress,
  configs: Array<{ symbol: string; config: TokenConfig; l1Address: string }>,
): Promise<Map<string, L2Token>> {
  console.log(`Batch deploying ${configs.length} L2 tokens...`);

  if (configs.length === 0) {
    return new Map();
  }

  // Create batch builder
  const batch = new ContractBatchBuilder(l2Client.getWallet());

  // Map to store token instances for later retrieval
  const tokenInstances = new Map<string, { address: AztecAddress; config: TokenConfig }>();

  // Add all token deployments to the batch
  for (const { symbol, config } of configs) {
    console.log(`Adding ${symbol} to batch deployment...`);

    // Create the deployment method (doesn't execute yet)
    const deployMethod = L2Token.deployMethod(
      l2Client,
      aztecPortalAddress,
      config.name,
      config.symbol,
      config.decimals,
    );

    // Add to batch
    batch.add(deployMethod);

    // Calculate the expected token address for later retrieval
    const tokenInstance = await L2Token.getInstance(aztecPortalAddress, config.name, config.symbol, config.decimals);

    tokenInstances.set(symbol, { address: tokenInstance.address, config });
  }

  // Execute batch deployment
  console.log('Executing batch deployment transaction...');
  const sentTx = batch.send({
    from: l2Client.getAddress(),
    fee: l2Client.getFeeOpts(),
  });

  console.log(`Batch deployment transaction submitted: ${await sentTx.getTxHash()}`);
  const receipt = await sentTx.wait();

  if (receipt.status !== TxStatus.SUCCESS) {
    throw new Error(`Batch L2 token deployment failed: ${receipt.status}`);
  }

  console.log(`Successfully deployed ${configs.length} L2 tokens in transaction ${receipt.txHash}`);

  // Create L2Token instances for all deployed tokens
  const deployedTokens = new Map<string, L2Token>();
  for (const [symbol, { address }] of tokenInstances) {
    const token = await L2Token.fromAddress(address, l2Client);
    deployedTokens.set(symbol, token);
    console.log(`${symbol} deployed at ${address.toString()}`);
  }

  return deployedTokens;
}

/**
 * Deploy multiple tokens with L1 deployment and batched L2 deployment
 * This reduces L2 transactions from N to 1 for N tokens
 */
export async function batchDeployTokens(
  l1Client: L1Client,
  l2Client: L2Client,
  aztecPortalAddress: string,
  tokens: Record<string, TokenConfig> = DEV_TOKENS,
): Promise<Record<string, TokenDeploymentResult>> {
  console.log(`Starting batch deployment of ${Object.keys(tokens).length} tokens...`);

  const result: Record<string, TokenDeploymentResult> = {};
  const l2DeploymentConfigs: Array<{ symbol: string; config: TokenConfig; l1Address: string }> = [];

  // Step 1: Deploy all L1 tokens first (these can't be batched on L1)
  console.log('Deploying L1 tokens...');
  const l1Addresses: Record<string, `0x${string}`> = {};
  for (const [symbol, config] of Object.entries(tokens)) {
    console.log(`Deploying L1 token ${symbol}...`);
    const l1Address = await deployL1DevToken(l1Client, config.name, config.symbol, config.decimals);
    l1Addresses[symbol] = l1Address;
    l2DeploymentConfigs.push({ symbol, config, l1Address });
  }

  // Step 2: Batch deploy all L2 tokens in a single transaction
  console.log('Batch deploying L2 tokens...');
  const l2Tokens = await batchDeployL2Tokens(
    l2Client,
    AztecAddress.fromString(aztecPortalAddress),
    l2DeploymentConfigs,
  );

  // Step 3: Build results
  for (const [symbol, config] of Object.entries(tokens)) {
    const l2Token = l2Tokens.get(symbol);
    if (!l2Token) {
      throw new Error(`Failed to deploy L2 token for ${symbol}`);
    }

    const l1Address = l1Addresses[symbol];
    if (!l1Address) {
      throw new Error(`Failed to find L1 address for ${symbol}`);
    }

    const serializableL2TokenInstance = new SerializableContractInstance(l2Token.getContract().instance);

    result[symbol] = {
      name: config.name,
      symbol: config.symbol,
      decimals: config.decimals,
      l1Address,
      l2Address: l2Token.getAddress().toString(),
      serializedL2TokenInstance: `0x${serializableL2TokenInstance.toBuffer().toString('hex')}`,
    };
  }

  console.log(`Successfully batch deployed ${Object.keys(tokens).length} tokens`);
  return result;
}
