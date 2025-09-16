import { IAllowListABI } from '@turnstile-portal/l1-artifacts-abi';
import { createPublicClient, http, type PublicClient } from 'viem';
import { anvil, mainnet, sepolia } from 'viem/chains';
import { logger } from './logger.js';

// Helper function to get chain by network name
export function getChainByNetwork(network: string) {
  switch (network) {
    case 'mainnet':
      return mainnet;
    case 'sepolia':
    case 'testnet':
      return sepolia;
    case 'sandbox':
      return anvil;
    default:
      logger.warn(`Unknown network "${network}", using undefined`);
      return undefined;
  }
}

// Helper function to create a PublicClient for a given RPC URL and network
export function getPublicClient(rpcUrl: string, network: string): PublicClient {
  const chain = getChainByNetwork(network);
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

// Helper function to get the L1 Allow List address from the L1 Portal contract
export async function getL1AllowListFromL1Portal(config: {
  rpcUrl: string;
  portalAddress: string;
  network: string;
}): Promise<string> {
  const publicClient = getPublicClient(config.rpcUrl, config.network);
  const portalAddress = config.portalAddress;

  const allowList = await publicClient.readContract({
    address: portalAddress as `0x${string}`,
    abi: IAllowListABI,
    functionName: 'allowList',
  });

  return allowList;
}

// Helper function to convert allow list status number to string
// 0 = UNKNOWN, 1 = PROPOSED, 2 = ACCEPTED, 3 = REJECTED
// The ABI for solidity enums only exposes the numeric value, so we need to convert it manually
export function allowListStatusNumberToString(status: number): 'UNKNOWN' | 'PROPOSED' | 'ACCEPTED' | 'REJECTED' {
  switch (status) {
    case 0:
      return 'UNKNOWN';
    case 1:
      return 'PROPOSED';
    case 2:
      return 'ACCEPTED';
    case 3:
      return 'REJECTED';
    default:
      throw new Error(`Unknown allow list status number: ${status}`);
  }
}
