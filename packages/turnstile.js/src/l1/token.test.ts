import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Address, PublicClient, WalletClient, Chain, Account, Transport } from 'viem';
import { L1Token } from './token.js';
import { TurnstileError } from '../errors.js';

// Mock the readContract and writeContract functions
const mockReadContract = vi.fn();
const mockWriteContract = vi.fn();
const mockWaitForTransactionReceipt = vi.fn();

// Mock the public client
const mockPublicClient = {
  readContract: mockReadContract,
  waitForTransactionReceipt: mockWaitForTransactionReceipt,
} as unknown as PublicClient;

// Mock the wallet client
const mockAccount = {
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address,
} as unknown as Account;

const mockWalletClient = {
  account: mockAccount,
  writeContract: mockWriteContract,
  chain: { id: 1 },
} as unknown as WalletClient<Transport, Chain, Account>;

// Mock L1Client
const mockL1Client = {
  getPublicClient: () => mockPublicClient,
  getWalletClient: () => mockWalletClient,
  getChainId: vi.fn().mockResolvedValue(1),
  getAddress: vi.fn().mockReturnValue(mockAccount.address),
};

// Setup mock data
const mockTokenAddress = '0x1234567890123456789012345678901234567890' as Address;
const mockSpender = '0x1111111111111111111111111111111111111111' as Address;
const mockAmount = 1000000000000000000n; // 1 token with 18 decimals
const mockTxHash = '0xabcdef1234567890';

describe('L1Token', () => {
  let token: L1Token;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Create a new token for each test
    token = new L1Token(mockTokenAddress, mockL1Client);
  });

  describe('getAddress', () => {
    it('should return the token address', () => {
      const address = token.getAddress();
      expect(address).toBe(mockTokenAddress);
    });
  });

  describe('getName', () => {
    it('should return the token name', async () => {
      // Setup mock
      const mockName = 'Test Token';
      mockReadContract.mockResolvedValueOnce(mockName);

      // Call the method
      const name = await token.getName();

      // Verify the result
      expect(name).toBe(mockName);
      expect(mockReadContract).toHaveBeenCalledTimes(1);
      expect(mockReadContract).toHaveBeenCalledWith(expect.objectContaining({
        address: mockTokenAddress,
        functionName: 'name',
      }));
    });

    it('should throw a TurnstileError on failure', async () => {
      // Setup mock to throw an error
      const mockError = new Error('Name read error');
      mockReadContract.mockRejectedValue(mockError);

      // Call the method and expect it to throw
      await expect(token.getName()).rejects.toThrow(TurnstileError);
    });
  });

  describe('getSymbol', () => {
    it('should return the token symbol', async () => {
      // Setup mock
      const mockSymbol = 'TEST';
      mockReadContract.mockResolvedValueOnce(mockSymbol);

      // Call the method
      const symbol = await token.getSymbol();

      // Verify the result
      expect(symbol).toBe(mockSymbol);
      expect(mockReadContract).toHaveBeenCalledTimes(1);
      expect(mockReadContract).toHaveBeenCalledWith(expect.objectContaining({
        address: mockTokenAddress,
        functionName: 'symbol',
      }));
    });

    it('should throw a TurnstileError on failure', async () => {
      // Setup mock to throw an error
      const mockError = new Error('Symbol read error');
      mockReadContract.mockRejectedValue(mockError);

      // Call the method and expect it to throw
      await expect(token.getSymbol()).rejects.toThrow(TurnstileError);
    });
  });

  describe('getDecimals', () => {
    it('should return the token decimals', async () => {
      // Setup mock
      const mockDecimals = 18;
      mockReadContract.mockResolvedValueOnce(mockDecimals);

      // Call the method
      const decimals = await token.getDecimals();

      // Verify the result
      expect(decimals).toBe(mockDecimals);
      expect(mockReadContract).toHaveBeenCalledTimes(1);
      expect(mockReadContract).toHaveBeenCalledWith(expect.objectContaining({
        address: mockTokenAddress,
        functionName: 'decimals',
      }));
    });

    it('should throw a TurnstileError on failure', async () => {
      // Setup mock to throw an error
      const mockError = new Error('Decimals read error');
      mockReadContract.mockRejectedValue(mockError);

      // Call the method and expect it to throw
      await expect(token.getDecimals()).rejects.toThrow(TurnstileError);
    });
  });

  describe('balanceOf', () => {
    it('should return the balance of an address', async () => {
      // Setup mock
      const mockBalance = 1000000000000000000n; // 1 token with 18 decimals
      mockReadContract.mockResolvedValueOnce(mockBalance);

      // Call the method
      const balance = await token.balanceOf(mockAccount.address);

      // Verify the result
      expect(balance).toBe(mockBalance);
      expect(mockReadContract).toHaveBeenCalledTimes(1);
      expect(mockReadContract).toHaveBeenCalledWith(expect.objectContaining({
        address: mockTokenAddress,
        functionName: 'balanceOf',
        args: [mockAccount.address],
      }));
    });

    it('should throw a TurnstileError on failure', async () => {
      // Setup mock to throw an error
      const mockError = new Error('Balance read error');
      mockReadContract.mockRejectedValue(mockError);

      // Call the method and expect it to throw
      await expect(token.balanceOf(mockAccount.address)).rejects.toThrow(TurnstileError);
    });
  });

  describe('allowance', () => {
    it('should return the allowance for a spender', async () => {
      // Setup mock
      const mockAllowance = 1000000000000000000n; // 1 token with 18 decimals
      mockReadContract.mockResolvedValueOnce(mockAllowance);

      // Call the method
      const allowance = await token.allowance(mockAccount.address, mockSpender);

      // Verify the result
      expect(allowance).toBe(mockAllowance);
      expect(mockReadContract).toHaveBeenCalledTimes(1);
      expect(mockReadContract).toHaveBeenCalledWith(expect.objectContaining({
        address: mockTokenAddress,
        functionName: 'allowance',
        args: [mockAccount.address, mockSpender],
      }));
    });

    it('should throw a TurnstileError on failure', async () => {
      // Setup mock to throw an error
      const mockError = new Error('Allowance read error');
      mockReadContract.mockRejectedValue(mockError);

      // Call the method and expect it to throw
      await expect(token.allowance(mockAccount.address, mockSpender)).rejects.toThrow(TurnstileError);
    });
  });

  describe('approve', () => {
    it('should approve a spender for tokens', async () => {
      // Setup mocks
      mockWriteContract.mockResolvedValueOnce(mockTxHash);
      mockWaitForTransactionReceipt.mockResolvedValueOnce({ status: 'success' });

      // Call the method
      const result = await token.approve(mockSpender, mockAmount);

      // Verify the result
      expect(result).toEqual({ status: 'success' });
      expect(mockWriteContract).toHaveBeenCalledTimes(1);
      expect(mockWriteContract).toHaveBeenCalledWith(expect.objectContaining({
        address: mockTokenAddress,
        functionName: 'approve',
        args: [mockSpender, mockAmount],
        account: mockAccount,
      }));
      expect(mockWaitForTransactionReceipt).toHaveBeenCalledTimes(1);
      expect(mockWaitForTransactionReceipt).toHaveBeenCalledWith({ hash: mockTxHash });
    });

    it('should throw a TurnstileError on failure', async () => {
      // Setup mock to throw an error
      const mockError = new Error('Approve error');
      mockWriteContract.mockRejectedValue(mockError);

      // Call the method and expect it to throw
      await expect(token.approve(mockSpender, mockAmount)).rejects.toThrow(TurnstileError);
    });

    it('should throw a TurnstileError when no account is connected to wallet client', async () => {
      // Create a wallet client with no account
      const walletClientWithoutAccount = {
        ...mockWalletClient,
        account: undefined,
      } as unknown as WalletClient<Transport, Chain, Account>;

      // Create a client that returns the wallet client without account
      const clientWithoutAccount = {
        ...mockL1Client,
        getWalletClient: () => walletClientWithoutAccount,
      };

      // Create a token with the client without account
      const tokenWithoutAccount = new L1Token(mockTokenAddress, clientWithoutAccount);

      // Call the method and expect it to throw
      await expect(tokenWithoutAccount.approve(mockSpender, mockAmount)).rejects.toThrow(TurnstileError);
      // Verify that the error message contains the expected text about failing to approve
      await expect(tokenWithoutAccount.approve(mockSpender, mockAmount)).rejects.toThrow(/Failed to approve/);
    });
  });

  describe('transfer', () => {
    it('should transfer tokens to a recipient', async () => {
      // Setup mocks
      mockWriteContract.mockResolvedValueOnce(mockTxHash);
      mockWaitForTransactionReceipt.mockResolvedValueOnce({ status: 'success' });

      // Call the method
      const result = await token.transfer(mockSpender, mockAmount);

      // Verify the result
      expect(result).toEqual({ status: 'success' });
      expect(mockWriteContract).toHaveBeenCalledTimes(1);
      expect(mockWriteContract).toHaveBeenCalledWith(expect.objectContaining({
        address: mockTokenAddress,
        functionName: 'transfer',
        args: [mockSpender, mockAmount],
        account: mockAccount,
      }));
      expect(mockWaitForTransactionReceipt).toHaveBeenCalledTimes(1);
      expect(mockWaitForTransactionReceipt).toHaveBeenCalledWith({ hash: mockTxHash });
    });

    it('should throw a TurnstileError on failure', async () => {
      // Setup mock to throw an error
      const mockError = new Error('Transfer error');
      mockWriteContract.mockRejectedValue(mockError);

      // Call the method and expect it to throw
      await expect(token.transfer(mockSpender, mockAmount)).rejects.toThrow(TurnstileError);
    });

    it('should throw a TurnstileError when no account is connected to wallet client', async () => {
      // Create a wallet client with no account
      const walletClientWithoutAccount = {
        ...mockWalletClient,
        account: undefined,
      } as unknown as WalletClient<Transport, Chain, Account>;

      // Create a client that returns the wallet client without account
      const clientWithoutAccount = {
        ...mockL1Client,
        getWalletClient: () => walletClientWithoutAccount,
      };

      // Create a token with the client without account
      const tokenWithoutAccount = new L1Token(mockTokenAddress, clientWithoutAccount);

      // Call the method and expect it to throw
      await expect(tokenWithoutAccount.transfer(mockSpender, mockAmount)).rejects.toThrow(TurnstileError);
      // Verify that the error message contains the expected text about failing to transfer
      await expect(tokenWithoutAccount.transfer(mockSpender, mockAmount)).rejects.toThrow(/Failed to transfer/);
    });
  });
});
