import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InsecureMintableToken } from './insecureMintableToken.js';
import { L1Client } from '@turnstile-portal/turnstile.js';
import type { Address } from 'viem';

// Mock dependencies
vi.mock('@turnstile-portal/turnstile.js');
// Import getContract directly so we can mock it
import * as viem from 'viem';

// Mock viem's formatUnits
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    formatUnits: vi.fn().mockReturnValue('1.0'),
  };
});

// Set up the getContract mock directly
beforeEach(() => {
  vi.spyOn(viem, 'getContract').mockReturnValue({
    read: {
      symbol: vi.fn().mockResolvedValue('TST'),
      decimals: vi.fn().mockResolvedValue(18),
    },
    write: {
      mint: vi.fn().mockResolvedValue('0xtxhash'),
    },
  } as any);
});

describe('InsecureMintableToken', () => {
  let mockL1Client: L1Client;
  let tokenAddress: Address;
  let recipientAddress: Address;
  let mockPublicClient: any;
  let mockWalletClient: any;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Set up addresses
    tokenAddress = '0x1234567890123456789012345678901234567890' as Address;
    recipientAddress = '0x0987654321098765432109876543210987654321' as Address;

    // Set up mock client
    mockPublicClient = {
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        status: 'success',
        transactionHash: '0xtxhash',
        contractAddress: '0xnewcontract'
      }),
      readContract: vi.fn().mockResolvedValue('TST'),
    };

    mockWalletClient = {
      account: { address: '0x1111111111111111111111111111111111111111' },
      chain: { id: 1, name: 'Mainnet' },
      deployContract: vi.fn().mockResolvedValue('0xdeployhash'),
    };

    // Mock L1Client implementation
    mockL1Client = {
      getPublicClient: vi.fn().mockReturnValue(mockPublicClient),
      getWalletClient: vi.fn().mockReturnValue(mockWalletClient),
      getChainId: vi.fn().mockResolvedValue(1),
      getAddress: vi.fn().mockReturnValue('0x1111111111111111111111111111111111111111'),
    } as unknown as L1Client;
  });

  describe('constructor', () => {
    it('should create an instance of InsecureMintableToken', () => {
      const token = new InsecureMintableToken(tokenAddress, mockL1Client);
      expect(token).toBeInstanceOf(InsecureMintableToken);
    });
  });

  describe('mint', () => {
    it('should mint tokens to a recipient', async () => {
      // Create a real token instance but with our mocked client
      const token = new InsecureMintableToken(tokenAddress, mockL1Client);
      const amount = BigInt(1000000000);

      // Explicitly set the client property on the token instance
      (token as any)['client'] = mockL1Client;

      // Create a mock contract with all the required methods
      const mockContract = {
        read: {
          symbol: vi.fn().mockResolvedValue('TST'),
          decimals: vi.fn().mockResolvedValue(18),
        },
        write: {
          mint: vi.fn().mockResolvedValue('0xtxhash'),
        },
      };

      // Mock the insecureMintableTokenContract method to return our mock contract
      vi.spyOn(token, 'insecureMintableTokenContract' as any).mockResolvedValue(mockContract);

      // Mock the transaction receipt
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
        status: 'success',
        transactionHash: '0xtxhash'
      });

      // Execute the mint function
      const receipt = await token.mint(tokenAddress, recipientAddress, amount);

      // Verify our mocked methods were called
      expect(mockContract.read.symbol).toHaveBeenCalled();
      expect(mockContract.read.decimals).toHaveBeenCalled();
      expect(mockContract.write.mint).toHaveBeenCalled();

      // Verify transaction was successful
      expect(receipt.status).toBe('success');
    });
  });

  describe('deploy', () => {
    it('should deploy a new InsecureMintableToken', async () => {
      const name = 'Test Token';
      const symbol = 'TST';
      const decimals = 18;

      const tokenAddress = await InsecureMintableToken.deploy(
        mockL1Client,
        name,
        symbol,
        decimals
      );

      // Verify the deployment transaction was sent
      expect(mockWalletClient.deployContract).toHaveBeenCalled();

      // Verify the receipt was awaited
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalled();

      // Verify the correct address was returned
      expect(tokenAddress).toBe('0xnewcontract');
    });

    it('should throw an error if deployment fails', async () => {
      // Mock a failed deployment
      mockPublicClient.waitForTransactionReceipt.mockResolvedValueOnce({
        status: 'reverted'
      });

      await expect(
        InsecureMintableToken.deploy(
          mockL1Client,
          'Failed Token',
          'FAIL',
          18
        )
      ).rejects.toThrow();
    });
  });
});
