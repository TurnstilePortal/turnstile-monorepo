// Utility functions for interacting with the Turnstile API to fetch token information.

import {
  createMainnetClient,
  createSandboxClient,
  createTestnetClient,
  type Token,
  type TurnstileApiClient,
} from '@turnstile-portal/api-client';
import { createError, ErrorCode } from './errors.js';
import type { IL1Client } from './l1/client.js';
import type { Hex } from './types.js';

export type BridgedTokenInfo = {
  l1TokenAddress: Hex;
  l2TokenAddress: Hex;
  symbol: string;
  name: string;
  decimals: number;
};

/**
 * Get the appropriate Turnstile API client based on the L1 client's chain ID.
 * @param l1Client - The L1 client to determine the chain ID from.
 * @returns A promise that resolves to the appropriate Turnstile API client.
 * @throws An error if the chain ID is unsupported.
 */
export async function getApiClient(l1Client: IL1Client): Promise<TurnstileApiClient> {
  const chainId = await l1Client.getChainId();
  let apiClient: TurnstileApiClient;
  switch (chainId) {
    case 1:
      apiClient = createMainnetClient();
      break;
    case 11155111:
      apiClient = createTestnetClient();
      break;
    case 31337:
      apiClient = createSandboxClient();
      break;
    default:
      throw createError(ErrorCode.L1_GENERAL, `Unsupported chain ID ${chainId} for Turnstile API client`, { chainId });
  }

  return apiClient;
}

/**
 * Fetches all bridged tokens from the Turnstile API for the given L1 client.
 * Bridged tokens are those that have been successfully registered on L2 and are available for bridging.
 * @param l1Client - The L1 client to use for fetching the tokens.
 * @returns A promise that resolves to an array of bridged tokens.
 * @throws An error if the fetch operation fails.
 */
export async function getAllBridgedTokens(l1Client: IL1Client): Promise<Token[]> {
  try {
    const apiClient = await getApiClient(l1Client);
    return await apiClient.getAllBridgedTokens();
  } catch (error) {
    throw createError(
      ErrorCode.L1_GENERAL,
      'Failed to get bridged tokens from the turnstile API',
      { chainId: await l1Client.getChainId() },
      error,
    );
  }
}

/**
 * Fetches all tokens from the Turnstile API for the given L1 client.
 * This includes all tokens that are either proposed, approved, or bridged.
 * @param l1Client - The L1 client to use for fetching the tokens.
 * @returns A promise that resolves to an array of all tokens.
 */
export async function getAllTokens(l1Client: IL1Client): Promise<Token[]> {
  try {
    const apiClient = await getApiClient(l1Client);
    return await apiClient.getAllTokens();
  } catch (error) {
    throw createError(
      ErrorCode.L1_GENERAL,
      'Failed to get all tokens from the turnstile API',
      { chainId: await l1Client.getChainId() },
      error,
    );
  }
}
