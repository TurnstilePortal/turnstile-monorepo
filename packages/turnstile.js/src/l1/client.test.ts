import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Address, PublicClient, WalletClient, Chain, Account, Transport } from 'viem';
import { L1Client } from './client.js';

// Mock the Viem clients
const mockGetChainId = vi.fn();
const mockPublicClient = {
  getChainId: mockGetChainId,
} as unknown as PublicClient;

const mockAccount = {
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address,
} as unknown as Account;

const mockWalletClient = {
  account: mockAccount,
} as unknown as WalletClient<Transport, Chain, Account>;

describe('L1Client', () => {
  let client: L1Client;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Create a new client for each test
    client = new L1Client(mockPublicClient, mockWalletClient);
  });

  describe('getPublicClient', () => {
    it('should return the public client', () => {
      const publicClient = client.getPublicClient();
      expect(publicClient).toBe(mockPublicClient);
    });
  });

  describe('getWalletClient', () => {
    it('should return the wallet client', () => {
      const walletClient = client.getWalletClient();
      expect(walletClient).toBe(mockWalletClient);
    });
  });

  describe('getChainId', () => {
    it('should return the chain ID from the public client', async () => {
      // Setup mock to return a value
      mockGetChainId.mockResolvedValue(1);

      const chainId = await client.getChainId();
      expect(chainId).toBe(1);
      expect(mockPublicClient.getChainId).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAddress', () => {
    it('should return the account address from the wallet client', () => {
      const address = client.getAddress();
      expect(address).toBe(mockAccount.address);
    });

    it('should throw an error if no account is connected', () => {
      // Create a client with a wallet client that has no account
      const noAccountWalletClient = {
        account: undefined,
      } as unknown as WalletClient<Transport, Chain, Account>;
      const clientWithNoAccount = new L1Client(mockPublicClient, noAccountWalletClient);

      expect(() => clientWithNoAccount.getAddress()).toThrow('No account connected to wallet client');
    });
  });
});
