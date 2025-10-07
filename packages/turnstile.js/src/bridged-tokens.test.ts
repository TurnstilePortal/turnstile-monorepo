import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockClients: Record<string, any> = {};

vi.mock('@turnstile-portal/api-client', () => {
  const createMockClient = (id: string) => {
    const client = {
      id,
      getAllBridgedTokens: vi.fn().mockResolvedValue([{ id: `${id}-bridged` }]),
      getAllProposedTokens: vi.fn().mockResolvedValue([{ id: `${id}-proposed` }]),
      getAllAcceptedTokens: vi.fn().mockResolvedValue([{ id: `${id}-accepted` }]),
      getAllRejectedTokens: vi.fn().mockResolvedValue([{ id: `${id}-rejected` }]),
      getAllTokens: vi.fn().mockResolvedValue([{ id: `${id}-all` }]),
      getTokenByAddress: vi.fn().mockResolvedValue({ id: `${id}-token` }),
    };
    mockClients[id] = client;
    return client;
  };

  const createMainnetClient = vi.fn(() => createMockClient('mainnet'));
  const createTestnetClient = vi.fn(() => createMockClient('testnet'));
  const createSandboxClient = vi.fn(() => createMockClient('sandbox'));

  class MockTurnstileApiClient {
    config: any;
    getAllBridgedTokens = vi.fn().mockResolvedValue([{ id: 'custom-bridged' }]);
    getAllProposedTokens = vi.fn().mockResolvedValue([{ id: 'custom-proposed' }]);
    getAllAcceptedTokens = vi.fn().mockResolvedValue([{ id: 'custom-accepted' }]);
    getAllRejectedTokens = vi.fn().mockResolvedValue([{ id: 'custom-rejected' }]);
    getAllTokens = vi.fn().mockResolvedValue([{ id: 'custom-all' }]);
    getTokenByAddress = vi.fn().mockResolvedValue({ id: 'custom-token' });

    constructor(config: any) {
      this.config = config;
      mockClients.custom = this;
    }
  }

  return {
    createMainnetClient,
    createTestnetClient,
    createSandboxClient,
    TurnstileApiClient: MockTurnstileApiClient,
  };
});

import {
  getAllAcceptedTokens,
  getAllBridgedTokens,
  getAllProposedTokens,
  getAllRejectedTokens,
  getAllTokens,
  getApiClient,
  getTokenByAddress,
} from './bridged-tokens.js';

describe('bridged tokens helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockClients).forEach((key) => delete mockClients[key]);
  });

  it('selects the correct API client for a chain id', async () => {
    await expect(getAllBridgedTokens(1)).resolves.toEqual([{ id: 'mainnet-bridged' }]);
    await expect(getAllProposedTokens(11155111, { limit: 5 })).resolves.toEqual([
      { id: 'testnet-proposed' },
    ]);
    await expect(getAllRejectedTokens(31337)).resolves.toEqual([{ id: 'sandbox-rejected' }]);
  });

  it('supports overriding the API base URL', async () => {
    const client = getApiClient(1, { baseUrl: 'https://example.com', headers: { Authorization: 'test' } });
    expect(client).toBe(mockClients.custom);
    expect(client.config).toMatchObject({ baseUrl: 'https://example.com', headers: { Authorization: 'test' } });

    const token = await getTokenByAddress('0xabc' as const, 1, { client: { baseUrl: 'https://example.com' } });
    expect(token).toEqual({ id: 'custom-token' });
  });

  it('forwards pagination options', async () => {
    const tokens = await getAllTokens(1, { limit: 2, cursor: 10 });
    expect(tokens).toEqual([{ id: 'mainnet-all' }]);
    const client = mockClients.mainnet;
    expect(client.getAllTokens).toHaveBeenCalledWith({ limit: 2, cursor: 10, cache: undefined });
  });
});
