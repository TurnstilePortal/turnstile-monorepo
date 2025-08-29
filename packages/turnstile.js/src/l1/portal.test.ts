// @ts-nocheck
// ^ This directive disables TypeScript checking for this file, which is appropriate for test files
// with complex mocks where TypeScript can't fully understand the runtime behavior of vitest mocks.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { L1Portal } from './portal.js';
import { SiblingPath } from '@aztec/aztec.js';
import { ErrorCode } from '../errors.js';
import type {
  Address,
  PublicClient,
  WalletClient,
  Chain,
  Account,
  Transport,
  TransactionReceipt,
  Hash
} from 'viem';
import { IL1Client } from './client.js';
import { ERC20TokenPortalABI } from '@turnstile-portal/l1-artifacts-abi';

// Mock external dependencies
vi.mock('viem', () => ({
  parseEventLogs: vi.fn(),
  encodeFunctionData: vi.fn(),
  getContract: vi.fn()
}));

vi.mock('../validator.js', () => ({
  validateWallet: vi.fn()
}));

describe('L1Portal', () => {
  // Common test variables
  const portalAddress = '0x1234567890123456789012345678901234567890' as Address;
  const mockL2PortalAddress = '0x0000000000000000000000000000000000000001' as `0x${string}`;
  const mockTokenAddress = '0x2222222222222222222222222222222222222222' as Address;
  const mockL2RecipientAddress = '0x3333333333333333333333333333333333333333' as `0x${string}`;
  const mockAmount = 1000n;
  const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hash;
  const mockMessageHash = '0x9999999999999999999999999999999999999999999999999999999999999999' as `0x${string}`;
  const mockMessageIndex = 123n;

  // Mock clients and contract
  let mockPublicClient: PublicClient;
  let mockWalletClient: WalletClient<Transport, Chain, Account>;
  let mockL1Client: IL1Client;
  let mockTokenPortalContract: any;
  let portal: L1Portal;

  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();

    // Create mock public client
    mockPublicClient = {
      readContract: vi.fn(),
      getChainId: vi.fn(),
      waitForTransactionReceipt: vi.fn()
    } as unknown as PublicClient;

    // Create mock wallet client with account
    mockWalletClient = {
      account: {
        address: '0x5555555555555555555555555555555555555555' as Address
      },
      writeContract: vi.fn(),
      chain: null
    } as unknown as WalletClient<Transport, Chain, Account>;

    // Create mock L1Client
    mockL1Client = {
      getPublicClient: vi.fn().mockReturnValue(mockPublicClient),
      getWalletClient: vi.fn().mockReturnValue(mockWalletClient),
      getChainId: vi.fn(),
      getAddress: vi.fn().mockReturnValue('0x5555555555555555555555555555555555555555' as Address)
    };

    // Create mock token portal contract
    mockTokenPortalContract = {
      read: {
        l2Portal: vi.fn(),
        aztecRollup: vi.fn()
      },
      write: {
        setL2Portal: vi.fn(),
        deposit: vi.fn(),
        register: vi.fn()
      },
      simulate: {
        withdraw: vi.fn()
      }
    };

    // Create L1Portal instance
    portal = new L1Portal(portalAddress, mockL1Client);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAddress', () => {
    it('should return the portal address', () => {
      const address = portal.getAddress();
      expect(address).toBe(portalAddress);
    });
  });

  describe('getL2Portal', () => {
    it('should return the L2 portal address when successful', async () => {
      // Mock tokenPortal method to return our mock contract
      vi.spyOn(portal, 'tokenPortal').mockResolvedValue(mockTokenPortalContract);
      mockTokenPortalContract.read.l2Portal.mockResolvedValue(mockL2PortalAddress);

      const result = await portal.getL2Portal();

      // Verify the result
      expect(result).toBe(mockL2PortalAddress);

      // Verify contract read was called
      expect(mockTokenPortalContract.read.l2Portal).toHaveBeenCalled();
    });

    it('should throw an error when contract read fails', async () => {
      // Mock tokenPortal method to return our mock contract
      vi.spyOn(portal, 'tokenPortal').mockResolvedValue(mockTokenPortalContract);

      // Mock contract read to throw an error
      const mockError = new Error('Contract read failed');
      mockTokenPortalContract.read.l2Portal.mockRejectedValue(mockError);

      // Expect the method to throw an error
      await expect(portal.getL2Portal()).rejects.toThrow();
    });
  });

  describe('setL2Portal', () => {
    it('should set the L2 portal address and return transaction receipt', async () => {
      // Mock tokenPortal method to return our mock contract
      vi.spyOn(portal, 'tokenPortal').mockResolvedValue(mockTokenPortalContract);

      // Mock contract write to return transaction hash
      mockTokenPortalContract.write.setL2Portal.mockResolvedValue(mockTxHash);

      // Mock transaction receipt
      const mockReceipt = {
        transactionHash: mockTxHash,
        status: 'success'
      } as unknown as TransactionReceipt;
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue(mockReceipt);

      // Call the method under test
      const result = await portal.setL2Portal(mockL2PortalAddress);

      // Check waitForTransactionReceipt was called
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: mockTxHash });

      // Verify the result is the transaction receipt
      expect(result).toBe(mockReceipt);
    });

    it('should throw an error when transaction fails', async () => {
      // Mock tokenPortal method to return our mock contract
      vi.spyOn(portal, 'tokenPortal').mockResolvedValue(mockTokenPortalContract);

      // Mock contract write to throw
      const mockError = new Error('Transaction failed');
      mockTokenPortalContract.write.setL2Portal.mockRejectedValue(mockError);

      // Expect the method to throw an error with correct code and original error as cause
      await expect(portal.setL2Portal(mockL2PortalAddress)).rejects.toMatchObject({
        code: ErrorCode.L1_CONTRACT_INTERACTION,
        cause: mockError
      });
    });
  });

  describe('deposit', () => {
    it('should deposit tokens and return transaction details', async () => {
      // Mock tokenPortal method to return our mock contract
      vi.spyOn(portal, 'tokenPortal').mockResolvedValue(mockTokenPortalContract);

      // Mock the imported functions
      const { validateWallet } = await import('../validator.js');
      const { encodeFunctionData, parseEventLogs } = await import('viem');

      // Setup function mocks
      validateWallet.mockReturnValue(mockWalletClient);
      encodeFunctionData.mockReturnValue('0xencoded_deposit_data');

      // Mock contract write to return transaction hash
      mockTokenPortalContract.write.deposit.mockResolvedValue(mockTxHash);

      // Mock transaction receipt
      const mockReceipt = {
        transactionHash: mockTxHash,
        status: 'success',
        logs: [{ topics: ['deposit_topic'] }]
      } as unknown as TransactionReceipt;
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue(mockReceipt);

      // Mock parseEventLogs to return both deposit and message sent logs
      parseEventLogs
        .mockReturnValueOnce([{
          args: {
            token: mockTokenAddress,
            sender: mockWalletClient.account?.address,
            leaf: mockMessageHash,
            index: mockMessageIndex
          }
        }])  // First call for Deposit event
        .mockReturnValueOnce([{
          args: {
            l2BlockNumber: 42n,
            index: mockMessageIndex,
            hash: mockMessageHash
          }
        }]);  // Second call for MessageSent event

      // Call the method under test
      const result = await portal.deposit(
        mockTokenAddress,
        mockL2RecipientAddress,
        mockAmount
      );

      // Verify the result contains the expected values including l2BlockNumber
      expect(result).toEqual({
        txHash: mockTxHash,
        messageHash: mockMessageHash,
        messageIndex: mockMessageIndex,
        l2BlockNumber: 42
      });
    });

    it('should throw an error when deposit fails', async () => {
      // Mock tokenPortal method to return our mock contract
      vi.spyOn(portal, 'tokenPortal').mockResolvedValue(mockTokenPortalContract);

      // Mock contract write to throw error
      const mockError = new Error('Deposit failed');
      mockTokenPortalContract.write.deposit.mockRejectedValue(mockError);

      // Expect the method to throw an error with correct code and original error as cause
      await expect(portal.deposit(mockTokenAddress, mockL2RecipientAddress, mockAmount))
        .rejects.toMatchObject({
          code: ErrorCode.L1_TOKEN_OPERATION,
          cause: mockError
        });
    });
  });

  describe('register', () => {
    it('should register a token and return transaction details', async () => {
      // Mock tokenPortal method to return our mock contract
      vi.spyOn(portal, 'tokenPortal').mockResolvedValue(mockTokenPortalContract);

      // Mock the imported functions
      const { parseEventLogs } = await import('viem');

      // Mock contract write to return transaction hash
      mockTokenPortalContract.write.register.mockResolvedValue(mockTxHash);

      // Mock transaction receipt
      const mockReceipt = {
        transactionHash: mockTxHash,
        status: 'success',
        logs: [{ topics: ['register_topic'] }]
      } as unknown as TransactionReceipt;
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue(mockReceipt);

      // Mock parseEventLogs to return both register and message sent logs
      parseEventLogs
        .mockReturnValueOnce([{
          args: {
            token: mockTokenAddress,
            leaf: mockMessageHash,
            index: mockMessageIndex
          }
        }])  // First call for Registered event
        .mockReturnValueOnce([{
          args: {
            l2BlockNumber: 42n,
            index: mockMessageIndex,
            hash: mockMessageHash
          }
        }]);  // Second call for MessageSent event

      // Call the method under test
      const result = await portal.register(mockTokenAddress);

      // Verify the result contains the expected values including l2BlockNumber
      expect(result).toEqual({
        txHash: mockTxHash,
        messageHash: mockMessageHash,
        messageIndex: mockMessageIndex,
        l2BlockNumber: 42
      });
    });

    it('should throw an error when register fails', async () => {
      // Mock tokenPortal method to return our mock contract
      vi.spyOn(portal, 'tokenPortal').mockResolvedValue(mockTokenPortalContract);

      // Mock contract write to throw error
      const mockError = new Error('Register failed');
      mockTokenPortalContract.write.register.mockRejectedValue(mockError);

      // Expect the method to throw an error
      await expect(portal.register(mockTokenAddress)).rejects.toThrow();
    });
  });

  describe('withdraw', () => {
    it('should withdraw tokens and return transaction hash', async () => {
      // Mock tokenPortal method to return our mock contract
      vi.spyOn(portal, 'tokenPortal').mockResolvedValue(mockTokenPortalContract);

      // Setup common test values
      const mockLeaf = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1' as `0x${string}`;
      const mockL2BlockNumber = 12345;
      const mockLeafIndex = 67n;

      // Create mock sibling path
      const mockSiblingPath = {
        toBufferArray: vi.fn().mockReturnValue([
          Buffer.from('1111111111111111111111111111111111111111111111111111111111111111', 'hex'),
          Buffer.from('2222222222222222222222222222222222222222222222222222222222222222', 'hex'),
        ])
      } as unknown as SiblingPath<number>;

      // Mock contract simulate to return request
      const mockRequest = { address: portalAddress, functionName: 'withdraw' };
      mockTokenPortalContract.simulate.withdraw.mockResolvedValue({ request: mockRequest });

      // Mock wallet writeContract to return transaction hash
      mockWalletClient.writeContract.mockResolvedValue(mockTxHash);

      // Call the method under test
      const result = await portal.withdraw(
        mockLeaf,
        mockL2BlockNumber,
        mockLeafIndex,
        mockSiblingPath
      );

      // Verify sibling path conversion
      expect(mockSiblingPath.toBufferArray).toHaveBeenCalled();

      // Verify writeContract was called with the request
      expect(mockWalletClient.writeContract).toHaveBeenCalledWith(mockRequest);

      // Verify the result is the transaction hash
      expect(result).toBe(mockTxHash);
    });

    it('should throw an error when withdraw fails', async () => {
      // Mock tokenPortal method to return our mock contract
      vi.spyOn(portal, 'tokenPortal').mockResolvedValue(mockTokenPortalContract);

      // Setup test values
      const mockLeaf = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1' as `0x${string}`;
      const mockL2BlockNumber = 12345;
      const mockLeafIndex = 67n;
      const mockSiblingPath = {
        toBufferArray: vi.fn().mockReturnValue([Buffer.from('11', 'hex')])
      } as unknown as SiblingPath<number>;

      // Mock contract simulate to throw error
      const mockError = new Error('Withdraw failed');
      mockTokenPortalContract.simulate.withdraw.mockRejectedValue(mockError);

      // Expect the method to throw an error
      await expect(portal.withdraw(
        mockLeaf,
        mockL2BlockNumber,
        mockLeafIndex,
        mockSiblingPath
      )).rejects.toThrow();
    });
  });

  describe('isBlockAvailableOnL1', () => {
    const mockRollupAddress = '0x7777777777777777777777777777777777777777' as Address;
    const mockL2BlockNumber = 100;
    const mockProvenBlockNumber = 120n;

    beforeEach(() => {
      // Create a new L1Portal instance with rollupAddress for some tests
      portal = new L1Portal(portalAddress, mockL1Client, mockRollupAddress);
    });

    it('should return true when block is available on L1', async () => {
      // Mock readContract to return chain tips with proven block number higher than requested
      mockPublicClient.readContract.mockResolvedValue({
        provenBlockNumber: mockProvenBlockNumber
      });

      const result = await portal.isBlockAvailableOnL1(mockL2BlockNumber);

      // Should be true because mockProvenBlockNumber > mockL2BlockNumber
      expect(result).toBe(true);

      // Verify readContract was called with correct function name
      expect(mockPublicClient.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: mockRollupAddress,
          functionName: 'getTips'
        })
      );
    });

    it('should return false when block is not available on L1', async () => {
      // Mock readContract to return chain tips with proven block number lower than requested
      mockPublicClient.readContract.mockResolvedValue({
        provenBlockNumber: 50n // Lower than mockL2BlockNumber (100)
      });

      const result = await portal.isBlockAvailableOnL1(mockL2BlockNumber);

      // Should be false because provenBlockNumber < mockL2BlockNumber
      expect(result).toBe(false);
    });

    it('should get rollup address if not provided', async () => {
      // Create portal without rollup address
      portal = new L1Portal(portalAddress, mockL1Client);

      // Mock tokenPortal method and aztecRollup read to return rollup address
      vi.spyOn(portal, 'tokenPortal').mockResolvedValue(mockTokenPortalContract);
      mockTokenPortalContract.read.aztecRollup.mockResolvedValue(mockRollupAddress);

      // Mock readContract to return chain tips
      mockPublicClient.readContract.mockResolvedValue({
        provenBlockNumber: mockProvenBlockNumber
      });

      const result = await portal.isBlockAvailableOnL1(mockL2BlockNumber);

      // Should be true because mockProvenBlockNumber > mockL2BlockNumber
      expect(result).toBe(true);

      // Verify aztecRollup was called
      expect(mockTokenPortalContract.read.aztecRollup).toHaveBeenCalled();
    });

    it('should throw error when check fails', async () => {
      // Mock readContract to throw an error
      const mockError = new Error('Chain tips check failed');
      mockPublicClient.readContract.mockRejectedValue(mockError);

      // Expect the method to throw an error
      await expect(portal.isBlockAvailableOnL1(mockL2BlockNumber)).rejects.toThrow();
    });
  });

  describe('waitForBlockOnL1', () => {
    const mockL2BlockNumber = 100;
    let currentTime = 1000000;

    beforeEach(() => {
      // Reset time counter for each test
      currentTime = 1000000;
      // Mock Date.now to return incrementing time to prevent infinite loops
      vi.spyOn(Date, 'now').mockImplementation(() => {
        currentTime += 6000; // Increment by 6 seconds each call to ensure timeout logic works
        return currentTime;
      });
    });

    it('should wait for block to be available on L1', async () => {
      // Mock the checkBlockAvailabilityWithTimeout method to return true immediately
      const mockCheckBlockAvailability = vi.spyOn(portal, 'checkBlockAvailabilityWithTimeout');
      mockCheckBlockAvailability.mockResolvedValue(true);

      await portal.waitForBlockOnL1(mockL2BlockNumber, 60, 5);

      // Verify checkBlockAvailabilityWithTimeout was called
      expect(mockCheckBlockAvailability).toHaveBeenCalledWith(
        mockL2BlockNumber,
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
        60,
        5
      );
    });

    it('should throw error when timeout is reached', async () => {
      // Reset time to ensure proper timeout behavior
      currentTime = 1000000;
      vi.spyOn(Date, 'now').mockImplementation(() => {
        currentTime += 2000; // Increment by 2 seconds each call
        return currentTime;
      });

      // Mock isBlockAvailableOnL1 to always return false
      const mockIsBlockAvailable = vi.spyOn(portal, 'isBlockAvailableOnL1');
      mockIsBlockAvailable.mockResolvedValue(false);

      // Expect the method to throw an error when timeout is reached
      await expect(portal.waitForBlockOnL1(mockL2BlockNumber, 1, 1)).rejects.toThrow();
    });

    it('should use default timeout and interval values', async () => {
      // Mock isBlockAvailableOnL1 to return true immediately
      const mockIsBlockAvailable = vi.spyOn(portal, 'isBlockAvailableOnL1');
      mockIsBlockAvailable.mockResolvedValue(true);

      await portal.waitForBlockOnL1(mockL2BlockNumber);

      // Verify isBlockAvailableOnL1 was called with default values
      expect(mockIsBlockAvailable).toHaveBeenCalledWith(mockL2BlockNumber);
    });

    it('should handle custom timeout and interval values', async () => {
      // Mock isBlockAvailableOnL1 to return true immediately
      const mockIsBlockAvailable = vi.spyOn(portal, 'isBlockAvailableOnL1');
      mockIsBlockAvailable.mockResolvedValue(true);

      const customTimeout = 120;
      const customInterval = 10;

      await portal.waitForBlockOnL1(mockL2BlockNumber, customTimeout, customInterval);

      // Verify isBlockAvailableOnL1 was called
      expect(mockIsBlockAvailable).toHaveBeenCalledWith(mockL2BlockNumber);
    });
  });
});
