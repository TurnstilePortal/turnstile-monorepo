import type { L1Client } from '@turnstile-portal/turnstile.js';
import { L1Portal } from '@turnstile-portal/turnstile.js';
import type { Address, TransactionReceipt } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setL2PortalOnL1Portal } from './l1Portal.js';

// Mock dependencies
vi.mock('@turnstile-portal/turnstile.js');

describe('L1Portal Deployment', () => {
  let mockL1Client: L1Client;
  let mockPortal: L1Portal;
  let mockReceipt: TransactionReceipt;
  let l1PortalAddress: Address;
  let l2PortalAddress: Address;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Create addresses
    l1PortalAddress = '0x1234567890123456789012345678901234567890' as Address;
    l2PortalAddress = '0x0987654321098765432109876543210987654321' as Address;

    // Mock transaction receipt
    mockReceipt = {
      status: 'success',
      transactionHash:
        '0x0000000000000000000000000000000000000000000000000000000000000123',
      blockHash:
        '0x0000000000000000000000000000000000000000000000000000000000000456',
      blockNumber: 12345n,
      transactionIndex: 0,
      logsBloom: '0x00',
      logs: [],
      contractAddress: null,
      effectiveGasPrice: 1n,
      gasUsed: 100000n,
      cumulativeGasUsed: 100000n,
      to: '0x1234567890123456789012345678901234567890',
      from: '0x0987654321098765432109876543210987654321',
      type: 'eip1559',
    };

    // Mock public client
    const mockPublicClient = {
      waitForTransactionReceipt: vi.fn().mockResolvedValue(mockReceipt),
      getChainId: vi.fn().mockResolvedValue(1),
    };

    // Mock wallet client
    const mockWalletClient = {
      account: { address: '0xWALLET_ADDRESS' as Address },
      chain: { id: 1, name: 'Mainnet' },
    };

    // Mock L1Client
    mockL1Client = {
      getPublicClient: vi.fn().mockReturnValue(mockPublicClient),
      getWalletClient: vi.fn().mockReturnValue(mockWalletClient),
      getChainId: vi.fn().mockResolvedValue(1),
      getAddress: vi.fn().mockReturnValue('0xWALLET_ADDRESS' as Address),
    } as unknown as L1Client;

    // Mock L1Portal
    mockPortal = {
      setL2Portal: vi.fn().mockResolvedValue(mockReceipt),
    } as unknown as L1Portal;

    // Mock L1Portal constructor
    vi.mocked(L1Portal).mockImplementation(() => mockPortal);
  });

  describe('setL2PortalOnL1Portal', () => {
    it('should set the L2 portal address on the L1 portal contract', async () => {
      // Call the function
      await setL2PortalOnL1Portal(
        mockL1Client,
        l1PortalAddress,
        l2PortalAddress,
      );

      // Verify the portal was created correctly
      expect(L1Portal).toHaveBeenCalledWith(l1PortalAddress, mockL1Client);

      // Verify the setL2Portal method was called
      expect(mockPortal.setL2Portal).toHaveBeenCalledWith(l2PortalAddress);
    });

    it('should throw an error if setting the L2 portal fails', async () => {
      // Mock failure
      mockReceipt.status = 'reverted';

      // Expect the function to throw
      await expect(
        setL2PortalOnL1Portal(mockL1Client, l1PortalAddress, l2PortalAddress),
      ).rejects.toThrow();
    });
  });
});
