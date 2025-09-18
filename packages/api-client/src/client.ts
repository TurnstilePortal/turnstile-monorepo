import { MAINNET_BASE_URL, SANDBOX_BASE_URL, TESTNET_BASE_URL } from './constants.js';
import type { paths } from './types.js';

export type TokensResponse = paths['/tokens']['get']['responses']['200']['content']['application/json'];
export type Token = paths['/tokens/{address}']['get']['responses']['200']['content']['application/json'];
export type ContractInstance = paths['/contract/{address}']['get']['responses']['200']['content']['application/json'];
export type ContractArtifact =
  paths['/artifact/{identifier}']['get']['responses']['200']['content']['application/json'];
export type ContractInstancesResponse =
  paths['/contracts/instances/{contractClassId}']['get']['responses']['200']['content']['application/json'];
export type ErrorResponse = { error: string };

export interface ClientConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}

export interface PaginationParams {
  limit?: number;
  cursor?: number;
}

export interface ApiClientOptions {
  limit?: number;
  cursor?: number;
  cache?: RequestCache; // 'default' | 'no-store' | 'reload' | 'no-cache' | 'force-cache' | 'only-if-cached'
}

export function createSandboxClient(config?: Omit<ClientConfig, 'baseUrl'>) {
  return new TurnstileApiClient({ baseUrl: SANDBOX_BASE_URL, ...config });
}

export function createTestnetClient(config?: Omit<ClientConfig, 'baseUrl'>) {
  return new TurnstileApiClient({ baseUrl: TESTNET_BASE_URL, ...config });
}

export function createMainnetClient(config?: Omit<ClientConfig, 'baseUrl'>) {
  return new TurnstileApiClient({ baseUrl: MAINNET_BASE_URL, ...config });
}

export class TurnstileApiClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly fetchFn: typeof fetch;

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
    this.fetchFn = config.fetch || fetch;
  }

  private async request<T>(path: string, options?: RequestInit & { cache?: RequestCache }): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await this.fetchFn.call(globalThis, url, {
      ...options,
      cache: options?.cache,
      headers: {
        ...this.headers,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = (await response.json()) as ErrorResponse;
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Ignore JSON parse errors
      }
      throw new Error(errorMessage);
    }

    return response.json() as Promise<T>;
  }

  private buildQueryString(params: PaginationParams | Record<string, string | number | boolean | undefined>): string {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  /**
   * Get a paginated list of all tokens
   */
  async getTokens(params?: PaginationParams, options?: { cache?: RequestCache }): Promise<TokensResponse> {
    const queryString = this.buildQueryString(params || {});
    return this.request<TokensResponse>(`/tokens${queryString}`, options);
  }

  /**
   * Get a token by its L1 or L2 address
   */
  async getTokenByAddress(address: string, options?: { cache?: RequestCache }): Promise<Token> {
    return this.request<Token>(`/tokens/${address}`, options);
  }

  /**
   * Get a paginated list of tokens with PROPOSED status
   */
  async getProposedTokens(params?: PaginationParams, options?: { cache?: RequestCache }): Promise<TokensResponse> {
    const queryString = this.buildQueryString(params || {});
    return this.request<TokensResponse>(`/tokens/proposed${queryString}`, options);
  }

  /**
   * Get a paginated list of tokens with REJECTED status
   */
  async getRejectedTokens(params?: PaginationParams, options?: { cache?: RequestCache }): Promise<TokensResponse> {
    const queryString = this.buildQueryString(params || {});
    return this.request<TokensResponse>(`/tokens/rejected${queryString}`, options);
  }

  /**
   * Get a paginated list of tokens with ACCEPTED status that are not yet fully bridged
   */
  async getAcceptedTokens(params?: PaginationParams, options?: { cache?: RequestCache }): Promise<TokensResponse> {
    const queryString = this.buildQueryString(params || {});
    return this.request<TokensResponse>(`/tokens/accepted${queryString}`, options);
  }

  /**
   * Get a paginated list of fully bridged tokens (with both L1 and L2 addresses)
   */
  async getBridgedTokens(params?: PaginationParams, options?: { cache?: RequestCache }): Promise<TokensResponse> {
    const queryString = this.buildQueryString(params || {});
    return this.request<TokensResponse>(`/tokens/bridged${queryString}`, options);
  }

  /**
   * Get a contract instance by its address, optionally including artifact data
   */
  async getContract(
    address: string,
    includeArtifact?: boolean,
    options?: { cache?: RequestCache },
  ): Promise<ContractInstance> {
    const queryString = this.buildQueryString(includeArtifact ? { includeArtifact: 'true' } : {});
    return this.request<ContractInstance>(`/contract/${address}${queryString}`, options);
  }

  /**
   * Get a contract artifact by contract class ID or artifact hash
   */
  async getArtifact(identifier: string, options?: { cache?: RequestCache }): Promise<ContractArtifact> {
    return this.request<ContractArtifact>(`/artifact/${identifier}`, options);
  }

  /**
   * Get all contract instance addresses that match the given contract class ID
   */
  async getContractInstancesByClassId(
    contractClassId: string,
    options?: { cache?: RequestCache },
  ): Promise<ContractInstancesResponse> {
    return this.request<ContractInstancesResponse>(`/contracts/instances/${contractClassId}`, options);
  }

  /**
   * Helper method to fetch all pages of a paginated endpoint
   */
  async *getAllPages<T extends TokensResponse>(
    fetcher: (params: PaginationParams, options?: { cache?: RequestCache }) => Promise<T>,
    options?: ApiClientOptions,
  ): AsyncGenerator<T['data'][number], void, unknown> {
    const limit = options?.limit ?? 100;
    let cursor = options?.cursor ?? 0;
    let hasMore = true;

    while (hasMore) {
      const response = await fetcher({ limit, cursor }, options);

      for (const item of response.data) {
        yield item;
      }

      hasMore = response.pagination.hasMore;
      if (hasMore && response.pagination.nextCursor !== undefined) {
        cursor = response.pagination.nextCursor;
      } else {
        hasMore = false;
      }
    }
  }

  /**
   * Fetch all tokens (auto-paginated)
   * @param options - Options including limit, cursor, and cache settings
   */
  async getAllTokens(options?: ApiClientOptions): Promise<Token[]> {
    const tokens: Token[] = [];
    for await (const token of this.getAllPages((params, options) => this.getTokens(params, options), options)) {
      tokens.push(token);
    }
    return tokens;
  }

  /**
   * Fetch all bridged tokens (auto-paginated)
   * @param options - Options including limit, cursor, and cache settings
   */
  async getAllBridgedTokens(options?: ApiClientOptions): Promise<Token[]> {
    const tokens: Token[] = [];
    for await (const token of this.getAllPages((params, options) => this.getBridgedTokens(params, options), options)) {
      tokens.push(token);
    }
    return tokens;
  }

  /**
   * Fetch all proposed tokens (auto-paginated)
   * @param options - Options including limit, cursor, and cache settings
   */
  async getAllProposedTokens(options?: ApiClientOptions): Promise<Token[]> {
    const tokens: Token[] = [];
    for await (const token of this.getAllPages((params, options) => this.getProposedTokens(params, options), options)) {
      tokens.push(token);
    }
    return tokens;
  }

  /**
   * Fetch all accepted tokens (auto-paginated)
   * @param options - Options including limit, cursor, and cache settings
   */
  async getAllAcceptedTokens(options?: ApiClientOptions): Promise<Token[]> {
    const tokens: Token[] = [];
    for await (const token of this.getAllPages((params, cache) => this.getAcceptedTokens(params, cache), options)) {
      tokens.push(token);
    }
    return tokens;
  }

  /**
   * Fetch all rejected tokens (auto-paginated)
   * @param options - Options including limit, cursor, and cache settings
   */
  async getAllRejectedTokens(options?: ApiClientOptions): Promise<Token[]> {
    const tokens: Token[] = [];
    for await (const token of this.getAllPages((params, cache) => this.getRejectedTokens(params, cache), options)) {
      tokens.push(token);
    }
    return tokens;
  }
}
