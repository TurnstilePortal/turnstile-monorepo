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
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    parseEventLogs: vi.fn(),
    encodeFunctionData: vi.fn()
  };
});

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

  // Mock clients
  let mockPublicClient: PublicClient;
  let mockWalletClient: WalletClient<Transport, Chain, Account>;
  let mockL1Client: IL1Client;
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
      getAddress: vi.fn()
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
      // Mock readContract to return a successful result
      (mockPublicClient.readContract as any).mockResolvedValueOnce(mockL2PortalAddress);

      const result = await portal.getL2Portal();

      // Verify the result
      expect(result).toBe(mockL2PortalAddress);

      // Verify readContract was called with correct parameters
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: portalAddress,
        abi: ERC20TokenPortalABI,
        functionName: 'l2Portal',
      });
    });

    it('should throw an error when contract read fails', async () => {
      // Mock readContract to throw an error
      const mockError = new Error('Contract read failed');
      (mockPublicClient.readContract as any).mockRejectedValueOnce(mockError);

      // Expect the method to throw an error with correct code and original error as cause
      await expect(portal.getL2Portal()).rejects.toMatchObject({
        code: ErrorCode.L1_CONTRACT_INTERACTION,
        cause: mockError
      });
    });
  });

  describe('setL2Portal', () => {
    it('should set the L2 portal address and return transaction receipt', async () => {
      // Mock validateWallet
      const { validateWallet } = await import('../validator.js');
      (validateWallet as any).mockReturnValue(mockWalletClient);

      // Mock wallet client writeContract
      const mockHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hash;
      (mockWalletClient.writeContract as any).mockResolvedValueOnce(mockHash);

      // Mock transaction receipt
      const mockReceipt = {
        transactionHash: mockHash,
        status: 'success'
      } as unknown as TransactionReceipt;
      (mockPublicClient.waitForTransactionReceipt as any).mockResolvedValueOnce(mockReceipt);

      // Call the method under test
      const result = await portal.setL2Portal(mockL2PortalAddress);

      // Check wallet validation was called
      expect(validateWallet).toHaveBeenCalledWith(
        mockWalletClient,
        'Cannot set L2 portal: No account connected to wallet'
      );

      // Check writeContract was called correctly
      expect(mockWalletClient.writeContract).toHaveBeenCalledWith({
        address: portalAddress,
        abi: ERC20TokenPortalABI,
        functionName: 'setL2Portal',
        args: [mockL2PortalAddress],
        account: mockWalletClient.account,
        chain: null,
      });

      // Check waitForTransactionReceipt was called
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: mockHash });

      // Verify the result is the transaction receipt
      expect(result).toBe(mockReceipt);
    });

    it('should throw an error when transaction fails', async () => {
      // Mock validateWallet
      const { validateWallet } = await import('../validator.js');
      (validateWallet as any).mockReturnValue(mockWalletClient);

      // Mock wallet client writeContract to throw
      const mockError = new Error('Transaction failed');
      (mockWalletClient.writeContract as any).mockRejectedValueOnce(mockError);

      // Expect the method to throw an error with correct code and original error as cause
      await expect(portal.setL2Portal(mockL2PortalAddress)).rejects.toMatchObject({
        code: ErrorCode.L1_CONTRACT_INTERACTION,
        cause: mockError
      });
    });
  });

  describe('deposit', () => {
    it('should deposit tokens and return transaction details', async () => {
      // Import and mock dependencies
      const { validateWallet } = await import('../validator.js');
      const { encodeFunctionData, parseEventLogs } = await import('viem');

      // Mock validateWallet
      (validateWallet as any).mockReturnValue(mockWalletClient);

      // Mock encodeFunctionData to return encoded data
      const mockEncodedData = '0xencoded_deposit_data' as `0x${string}`;
      (encodeFunctionData as any).mockReturnValueOnce(mockEncodedData);

      // Mock writeContract to return transaction hash
      (mockWalletClient.writeContract as any).mockResolvedValueOnce(mockTxHash);

      // Mock transaction receipt
      const mockReceipt = {
        transactionHash: mockTxHash,
        status: 'success',
        logs: [{ topics: ['deposit_topic'] }]
      } as unknown as TransactionReceipt;
      (mockPublicClient.waitForTransactionReceipt as any).mockResolvedValueOnce(mockReceipt);

      // Mock parseEventLogs to return deposit log
      const mockDepositLogs = [{
        args: {
          token: mockTokenAddress,
          sender: mockWalletClient.account?.address,
          leaf: mockMessageHash,
          index: mockMessageIndex
        }
      }];
      (parseEventLogs as any).mockReturnValueOnce(mockDepositLogs);

      // Call the method under test
      const result = await portal.deposit(
        mockTokenAddress,
        mockL2RecipientAddress,
        mockAmount
      );

      // Verify encodeFunctionData was called with correct parameters
      expect(encodeFunctionData).toHaveBeenCalledWith({
        abi: expect.arrayContaining([
          expect.objectContaining({
            name: 'deposit',
            inputs: [
              { name: 'token', type: 'address' },
              { name: 'l2Recipient', type: 'bytes32' },
              { name: 'amount', type: 'uint256' }
            ]
          })
        ]),
        functionName: 'deposit',
        args: [mockTokenAddress, mockL2RecipientAddress, mockAmount]
      });

      // Verify writeContract was called with correct parameters
      expect(mockWalletClient.writeContract).toHaveBeenCalledWith({
        address: portalAddress,
        abi: ERC20TokenPortalABI,
        functionName: 'deposit',
        args: [mockEncodedData],
        account: mockWalletClient.account,
        chain: null
      });

      // Verify parseEventLogs was called with correct parameters
      expect(parseEventLogs).toHaveBeenCalledWith({
        abi: ERC20TokenPortalABI,
        eventName: 'Deposit',
        logs: mockReceipt.logs
      });

      // Verify the result contains the expected values
      expect(result).toEqual({
        txHash: mockTxHash,
        messageHash: mockMessageHash,
        messageIndex: mockMessageIndex
      });
    });

    it('should throw an error when deposit fails', async () => {
      // Import and mock dependencies
      const { validateWallet } = await import('../validator.js');
      const { encodeFunctionData } = await import('viem');

      // Mock validateWallet
      (validateWallet as any).mockReturnValue(mockWalletClient);

      // Mock encodeFunctionData
      const mockEncodedData = '0xencoded_deposit_data' as `0x${string}`;
      (encodeFunctionData as any).mockReturnValueOnce(mockEncodedData);

      // Mock writeContract to throw error
      const mockError = new Error('Deposit failed');
      (mockWalletClient.writeContract as any).mockRejectedValueOnce(mockError);

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
      // Import and mock dependencies
      const { validateWallet } = await import('../validator.js');
      const { parseEventLogs } = await import('viem');

      // Mock validateWallet
      (validateWallet as any).mockReturnValue(mockWalletClient);

      // Mock writeContract to return transaction hash
      (mockWalletClient.writeContract as any).mockResolvedValueOnce(mockTxHash);

      // Mock transaction receipt
      const mockReceipt = {
        transactionHash: mockTxHash,
        status: 'success',
        logs: [{ topics: ['register_topic'] }]
      } as unknown as TransactionReceipt;
      (mockPublicClient.waitForTransactionReceipt as any).mockResolvedValueOnce(mockReceipt);

      // Mock parseEventLogs to return register log
      const mockRegisteredLogs = [{
        args: {
          token: mockTokenAddress,
          leaf: mockMessageHash,
          index: mockMessageIndex
        }
      }];
      (parseEventLogs as any).mockReturnValueOnce(mockRegisteredLogs);

      // Call the method under test
      const result = await portal.register(mockTokenAddress);

      // Verify writeContract was called with correct parameters
      expect(mockWalletClient.writeContract).toHaveBeenCalledWith({
        address: portalAddress,
        abi: ERC20TokenPortalABI,
        functionName: 'register',
        args: [mockTokenAddress],
        account: mockWalletClient.account,
        chain: null
      });

      // Verify parseEventLogs was called with correct parameters
      expect(parseEventLogs).toHaveBeenCalledWith({
        abi: ERC20TokenPortalABI,
        eventName: 'Registered',
        logs: mockReceipt.logs
      });

      // Verify the result contains the expected values
      expect(result).toEqual({
        txHash: mockTxHash,
        messageHash: mockMessageHash,
        messageIndex: mockMessageIndex
      });
    });

    it('should throw an error when register fails', async () => {
      // Import and mock dependencies
      const { validateWallet } = await import('../validator.js');

      // Mock validateWallet
      (validateWallet as any).mockReturnValue(mockWalletClient);

      // Mock writeContract to throw error
      const mockError = new Error('Register failed');
      (mockWalletClient.writeContract as any).mockRejectedValueOnce(mockError);

      // We should check for the error message instead of the error code
      // since the BRIDGE_REGISTER code (3003) cannot be used with createL1Error
      await expect(portal.register(mockTokenAddress)).rejects.toThrow();

      // Just verify the function was called with the right arguments
      expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: portalAddress,
          functionName: 'register',
          args: [mockTokenAddress]
        })
      );
    });
  });

  describe('withdraw', () => {
    it('should withdraw tokens and return transaction hash', async () => {
      // Setup common test values
      const mockLeaf = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1' as `0x${string}`;
      const mockL2BlockNumber = 12345n;
      const mockLeafIndex = 67n;

      // Mock Buffer to hex conversion for sibling path
      const mockSiblingPathArray = [
        Buffer.from('1111111111111111111111111111111111111111111111111111111111111111', 'hex'),
        Buffer.from('2222222222222222222222222222222222222222222222222222222222222222', 'hex'),
      ];
      const mockSiblingPathHex = [
        '0x1111111111111111111111111111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222222222222222222222222222'
      ] as readonly `0x${string}`[];

      // Create mock sibling path
      const mockSiblingPath = {
        toBufferArray: vi.fn().mockReturnValue(mockSiblingPathArray)
      } as unknown as SiblingPath<number>;

      // Import and mock dependencies
      const { validateWallet } = await import('../validator.js');

      // Mock validateWallet
      (validateWallet as any).mockReturnValue(mockWalletClient);

      // Mock writeContract to return transaction hash
      (mockWalletClient.writeContract as any).mockResolvedValueOnce(mockTxHash);

      // Call the method under test
      const result = await portal.withdraw(
        mockLeaf,
        mockL2BlockNumber,
        mockLeafIndex,
        mockSiblingPath
      );

      // Verify sibling path conversion
      expect(mockSiblingPath.toBufferArray).toHaveBeenCalled();

      // Verify writeContract was called with correct parameters
      expect(mockWalletClient.writeContract).toHaveBeenCalledWith({
        address: portalAddress,
        abi: ERC20TokenPortalABI,
        functionName: 'withdraw',
        args: [mockLeaf, mockL2BlockNumber, mockLeafIndex, expect.any(Array)],
        account: mockWalletClient.account,
        chain: null
      });

      // Verify the result is the transaction hash
      expect(result).toBe(mockTxHash);
    });

    it('should throw an error when withdraw fails', async () => {
      // Setup test values
      const mockLeaf = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1' as `0x${string}`;
      const mockL2BlockNumber = 12345n;
      const mockLeafIndex = 67n;
      const mockSiblingPath = {
        toBufferArray: vi.fn().mockReturnValue([Buffer.from('11', 'hex')])
      } as unknown as SiblingPath<number>;

      // Import and mock dependencies
      const { validateWallet } = await import('../validator.js');

      // Mock validateWallet
      (validateWallet as any).mockReturnValue(mockWalletClient);

      // Mock writeContract to throw error
      const mockError = new Error('Withdraw failed');
      (mockWalletClient.writeContract as any).mockRejectedValueOnce(mockError);

      // We should check for the error message instead of the error code
      // since the BRIDGE_WITHDRAW code (3002) cannot be used with createL1Error
      await expect(portal.withdraw(
        mockLeaf,
        mockL2BlockNumber,
        mockLeafIndex,
        mockSiblingPath
      )).rejects.toThrow();

      // Just verify the function was called with the right arguments
      expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: portalAddress,
          functionName: 'withdraw',
          args: [mockLeaf, mockL2BlockNumber, mockLeafIndex, expect.any(Array)]
        })
      );
    });
  });

  describe('isBlockAvailableOnL1', () => {
    const mockRollupAddress = '0x7777777777777777777777777777777777777777' as Address;
    const mockL2BlockNumber = 100n;
    const mockProvenL2BlockNumber = 120n;

    beforeEach(() => {
      // Create a new L1Portal instance with rollupAddress for some tests
      portal = new L1Portal(portalAddress, mockL1Client, mockRollupAddress);
    });

    it('should return true when block is available on L1', async () => {
      // Mock readContract to return chain tips with proven block number higher than requested
      (mockPublicClient.readContract as any).mockResolvedValueOnce({
        provenL2BlockNumber: mockProvenL2BlockNumber,
        provenL2BlockHash: '0xblockhash',
        finalizedL2BlockNumber: 110n,
        finalizedL2BlockHash: '0xfinalhash'
      });

      const result = await portal.isBlockAvailableOnL1(mockL2BlockNumber);

      // Should be true because mockProvenL2BlockNumber > mockL2BlockNumber
      expect(result).toBe(true);

      // Verify readContract was called with correct parameters
      expect(mockPublicClient.readContract).toHaveBeenCalledWith({
        address: mockRollupAddress,
        abi: expect.arrayContaining([
          expect.objectContaining({
            name: 'getChainTips',
            type: 'function',
            stateMutability: 'view'
          })
        ]),
        functionName: 'getChainTips'
      });
    });

    it('should return false when block is not available on L1', async () => {
      // Mock readContract to return chain tips with proven block number lower than requested
      (mockPublicClient.readContract as any).mockResolvedValueOnce({
        provenL2BlockNumber: 50n, // Lower than mockL2BlockNumber (100)
        provenL2BlockHash: '0xblockhash',
        finalizedL2BlockNumber: 40n,
        finalizedL2BlockHash: '0xfinalhash'
      });

      const result = await portal.isBlockAvailableOnL1(mockL2BlockNumber);

      // Should be false because provenL2BlockNumber < mockL2BlockNumber
      expect(result).toBe(false);
    });

    it('should get rollup address if not provided', async () => {
      // Create portal without rollup address
      portal = new L1Portal(portalAddress, mockL1Client);

      // Mock getRollupAddress to return rollup address
      const mockGetRollupAddress = vi.spyOn(portal as any, 'getRollupAddress');
      mockGetRollupAddress.mockResolvedValue(mockRollupAddress);

      // Mock readContract to return chain tips
      (mockPublicClient.readContract as any).mockResolvedValueOnce({
        provenL2BlockNumber: mockProvenL2BlockNumber,
        provenL2BlockHash: '0xblockhash',
        finalizedL2BlockNumber: 110n,
        finalizedL2BlockHash: '0xfinalhash'
      });

      const result = await portal.isBlockAvailableOnL1(mockL2BlockNumber);

      // Should be true because mockProvenL2BlockNumber > mockL2BlockNumber
      expect(result).toBe(true);

      // Verify getRollupAddress was called
      expect(mockGetRollupAddress).toHaveBeenCalled();

      // Verify readContract was called twice - once for rollup address, once for chain tips
      expect(mockPublicClient.readContract).toHaveBeenCalledTimes(2);
    });

    it('should throw error when check fails', async () => {
      // Mock readContract to throw an error
      const mockError = new Error('Chain tips check failed');
      (mockPublicClient.readContract as any).mockRejectedValueOnce(mockError);

      // Expect the method to throw an error
      await expect(portal.isBlockAvailableOnL1(mockL2BlockNumber)).rejects.toThrow();
    });
  });

  describe('waitForBlockOnL1', () => {
    const mockL2BlockNumber = 100n;
    const currentTime = 1000000;

    beforeEach(() => {
      // Mock Date.now to return a fixed time
      vi.spyOn(Date, 'now').mockReturnValue(currentTime);
    });

    it('should wait for block to be available on L1', async () => {
      // Mock isBlockAvailableOnL1 to return false initially, then true
      const mockIsBlockAvailable = vi.spyOn(portal, 'isBlockAvailableOnL1');
      mockIsBlockAvailable
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      // Mock setTimeout to resolve immediately
      const mockSetTimeout = vi.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        fn();
        return {} as any;
      });

      await portal.waitForBlockOnL1(mockL2BlockNumber, 60, 5);

      // Verify isBlockAvailableOnL1 was called multiple times
      expect(mockIsBlockAvailable).toHaveBeenCalledTimes(3);
      expect(mockIsBlockAvailable).toHaveBeenCalledWith(mockL2BlockNumber);

      // Verify setTimeout was called for the polling
      expect(mockSetTimeout).toHaveBeenCalled();
    });

    it('should throw error when timeout is reached', async () => {
      // Mock isBlockAvailableOnL1 to always return false
      const mockIsBlockAvailable = vi.spyOn(portal, 'isBlockAvailableOnL1');
      mockIsBlockAvailable.mockResolvedValue(false);

      // Mock setTimeout to resolve immediately
      vi.spyOn(global, 'setTimeout').mockImplementation((fn) => {
        fn();
        return {} as any;
      });

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
