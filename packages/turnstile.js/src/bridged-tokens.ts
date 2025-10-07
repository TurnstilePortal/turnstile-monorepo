import {
  type Token as ApiToken,
  createMainnetClient,
  createSandboxClient,
  createTestnetClient,
  TurnstileApiClient,
} from '@turnstile-portal/api-client';
import { createError, ErrorCode } from './errors.js';
import type { Hex } from './types.js';

export { Token as ApiToken } from '@turnstile-portal/api-client';

export type ApiClientConfig = {
  baseUrl?: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
};

export type TokenListOptions = {
  limit?: number;
  cursor?: number;
  cache?: RequestCache;
  client?: ApiClientConfig;
};

export function getApiClient(chainId: number, config: ApiClientConfig = {}): TurnstileApiClient {
  if (config.baseUrl) {
    return new TurnstileApiClient({ baseUrl: config.baseUrl, headers: config.headers, fetch: config.fetch });
  }

  switch (chainId) {
    case 1:
      return createMainnetClient({ headers: config.headers, fetch: config.fetch });
    case 11155111:
      return createTestnetClient({ headers: config.headers, fetch: config.fetch });
    case 31337:
      return createSandboxClient({ headers: config.headers, fetch: config.fetch });
    default:
      throw createError(ErrorCode.L1_GENERAL, `Unsupported chain ID ${chainId} for Turnstile API client`, { chainId });
  }
}

export async function getAllBridgedTokens(
  chainId: number,
  options: TokenListOptions = {},
): Promise<ApiToken[]> {
  try {
    const apiClient = getApiClient(chainId, options.client);
    return apiClient.getAllBridgedTokens({
      limit: options.limit,
      cursor: options.cursor,
      cache: options.cache,
    });
  } catch (error) {
    throw createError(ErrorCode.L1_GENERAL, 'Failed to get bridged tokens from the turnstile API', { chainId }, error);
  }
}

export async function getAllProposedTokens(
  chainId: number,
  options: TokenListOptions = {},
): Promise<ApiToken[]> {
  try {
    const apiClient = getApiClient(chainId, options.client);
    return apiClient.getAllProposedTokens({
      limit: options.limit,
      cursor: options.cursor,
      cache: options.cache,
    });
  } catch (error) {
    throw createError(ErrorCode.L1_GENERAL, 'Failed to get proposed tokens from the turnstile API', { chainId }, error);
  }
}

export async function getAllAcceptedTokens(
  chainId: number,
  options: TokenListOptions = {},
): Promise<ApiToken[]> {
  try {
    const apiClient = getApiClient(chainId, options.client);
    return apiClient.getAllAcceptedTokens({
      limit: options.limit,
      cursor: options.cursor,
      cache: options.cache,
    });
  } catch (error) {
    throw createError(ErrorCode.L1_GENERAL, 'Failed to get approved tokens from the turnstile API', { chainId }, error);
  }
}

export async function getAllRejectedTokens(
  chainId: number,
  options: TokenListOptions = {},
): Promise<ApiToken[]> {
  try {
    const apiClient = getApiClient(chainId, options.client);
    return apiClient.getAllRejectedTokens({
      limit: options.limit,
      cursor: options.cursor,
      cache: options.cache,
    });
  } catch (error) {
    throw createError(ErrorCode.L1_GENERAL, 'Failed to get rejected tokens from the turnstile API', { chainId }, error);
  }
}

export async function getAllTokens(
  chainId: number,
  options: TokenListOptions = {},
): Promise<ApiToken[]> {
  try {
    const apiClient = getApiClient(chainId, options.client);
    return apiClient.getAllTokens({
      limit: options.limit,
      cursor: options.cursor,
      cache: options.cache,
    });
  } catch (error) {
    throw createError(ErrorCode.L1_GENERAL, 'Failed to get all tokens from the turnstile API', { chainId }, error);
  }
}

export async function getTokenByAddress(
  tokenAddress: Hex,
  chainId: number,
  options: { cache?: RequestCache; client?: ApiClientConfig } = {},
): Promise<ApiToken> {
  try {
    const apiClient = getApiClient(chainId, options.client);
    return apiClient.getTokenByAddress(tokenAddress, { cache: options.cache });
  } catch (error) {
    throw createError(
      ErrorCode.L1_GENERAL,
      `Failed to get token ${tokenAddress} from the turnstile API`,
      { chainId, tokenAddress },
      error,
    );
  }
}
