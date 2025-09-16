// Utility functions for interacting with the Turnstile API to fetch token information.

import {
  type Token as ApiToken,
  createMainnetClient,
  createSandboxClient,
  createTestnetClient,
  type TurnstileApiClient,
} from '@turnstile-portal/api-client';
import { createError, ErrorCode } from './errors.js';
import type { IL1Client } from './l1/client.js';
import type { Hex } from './types.js';

// Re-export the Token type from the Turnstile API client for external use.
export { Token as ApiToken } from '@turnstile-portal/api-client';

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
 * @param options - Optional parameters for pagination and caching.
 * @returns A promise that resolves to an array of bridged tokens.
 * @throws An error if the fetch operation fails.
 */
export async function getAllBridgedTokens(
  l1Client: IL1Client,
  options?: { limit?: number; startCursor?: number; cache?: RequestCache },
): Promise<ApiToken[]> {
  try {
    const apiClient = await getApiClient(l1Client);
    return await apiClient.getAllBridgedTokens({
      limit: options?.limit,
      cursor: options?.startCursor,
      cache: options?.cache,
    });
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
 * Fetches all proposed tokens from the Turnstile API for the given L1 client.
 * Proposed tokens are those that have been suggested for bridging but have not yet been approved.
 * @param l1Client - The L1 client to use for fetching the tokens.
 * @param options - Optional parameters for pagination and caching.
 * @returns A promise that resolves to an array of proposed tokens.
 * @throws An error if the fetch operation fails.
 */
export async function getAllProposedTokens(
  l1Client: IL1Client,
  options?: { limit?: number; startCursor?: number; cache?: RequestCache },
): Promise<ApiToken[]> {
  try {
    const apiClient = await getApiClient(l1Client);
    return await apiClient.getAllProposedTokens({
      limit: options?.limit,
      cursor: options?.startCursor,
      cache: options?.cache,
    });
  } catch (error) {
    throw createError(
      ErrorCode.L1_GENERAL,
      'Failed to get proposed tokens from the turnstile API',
      { chainId: await l1Client.getChainId() },
      error,
    );
  }
}

/**
 * Fetches all accepted tokens from the Turnstile API for the given L1 client.
 * Accepted tokens are those that have been approved for bridging but may not yet be bridged.
 * @param l1Client - The L1 client to use for fetching the tokens.
 * @param options - Optional parameters for pagination and caching.
 * @returns A promise that resolves to an array of accepted tokens.
 * @throws An error if the fetch operation fails.
 */
export async function getAllAcceptedTokens(
  l1Client: IL1Client,
  options?: { limit?: number; startCursor?: number; cache?: RequestCache },
): Promise<ApiToken[]> {
  try {
    const apiClient = await getApiClient(l1Client);
    return await apiClient.getAllAcceptedTokens({
      limit: options?.limit,
      cursor: options?.startCursor,
      cache: options?.cache,
    });
  } catch (error) {
    throw createError(
      ErrorCode.L1_GENERAL,
      'Failed to get approved tokens from the turnstile API',
      { chainId: await l1Client.getChainId() },
      error,
    );
  }
}

/**
 * Fetches all rejected tokens from the Turnstile API for the given L1 client.
 * Rejected tokens are those that have been proposed then then rejected for bridging.
 * @param l1Client - The L1 client to use for fetching the tokens.
 * @param options - Optional parameters for pagination and caching.
 * @returns A promise that resolves to an array of rejected tokens.
 * @throws An error if the fetch operation fails.
 */
export async function getAllRejectedTokens(
  l1Client: IL1Client,
  options?: { limit?: number; startCursor?: number; cache?: RequestCache },
): Promise<ApiToken[]> {
  try {
    const apiClient = await getApiClient(l1Client);
    return await apiClient.getAllRejectedTokens({
      limit: options?.limit,
      cursor: options?.startCursor,
      cache: options?.cache,
    });
  } catch (error) {
    throw createError(
      ErrorCode.L1_GENERAL,
      'Failed to get rejected tokens from the turnstile API',
      { chainId: await l1Client.getChainId() },
      error,
    );
  }
}

/**
 * Fetches all tokens from the Turnstile API for the given L1 client.
 * This includes all tokens that are either proposed, approved, or bridged.
 * @param l1Client - The L1 client to use for fetching the tokens.
 * @param options - Optional parameters for pagination and caching.
 * @returns A promise that resolves to an array of all tokens.
 */
export async function getAllTokens(
  l1Client: IL1Client,
  options?: { limit?: number; startCursor?: number; cache?: RequestCache },
): Promise<ApiToken[]> {
  try {
    const apiClient = await getApiClient(l1Client);
    return await apiClient.getAllTokens({ limit: options?.limit, cursor: options?.startCursor, cache: options?.cache });
  } catch (error) {
    throw createError(
      ErrorCode.L1_GENERAL,
      'Failed to get all tokens from the turnstile API',
      { chainId: await l1Client.getChainId() },
      error,
    );
  }
}

export async function getTokenByAddress(
  tokenAddress: Hex,
  l1Client: IL1Client,
  options?: { cache?: RequestCache },
): Promise<ApiToken> {
  try {
    const apiClient = await getApiClient(l1Client);
    return await apiClient.getTokenByAddress(tokenAddress, options);
  } catch (error) {
    throw createError(
      ErrorCode.L1_GENERAL,
      `Failed to get token ${tokenAddress} from the turnstile API`,
      { chainId: await l1Client.getChainId(), tokenAddress },
      error,
    );
  }
}
