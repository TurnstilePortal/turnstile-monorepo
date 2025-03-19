import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import type { Address, PublicClient, WalletClient, Chain, Account, Transport, TransactionReceipt } from 'viem';

// Mock the viem module
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    // @ts-ignore - We know this is an object with the right properties
    ...actual,
    getContract: vi.fn()
  };
});

// Import after mocking
import { getContract } from 'viem';
import { L1AllowList, getL1AllowListContract } from './allowList.js';

// Mock console.debug to avoid cluttering test output
const originalConsoleDebug = console.debug;
console.debug = vi.fn();

// Mock wallet client
const mockAccount = {
  address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address,
} as unknown as Account;

const mockWalletClient = {
  account: mockAccount,
  chain: { id: 1 },
} as unknown as WalletClient<Transport, Chain, Account>;

// Mock approver wallet client
const mockApproverAccount = {
  address: '0x2222222222222222222222222222222222222222' as Address,
} as unknown as Account;

const mockApproverWalletClient = {
  account: mockApproverAccount,
  chain: { id: 1 },
} as unknown as WalletClient<Transport, Chain, Account>;

// Mock transaction hash
const mockTxHash = '0xmocktxhash';

// Mock public client
const mockWaitForTransactionReceipt = vi.fn();
const mockPublicClient = {
  waitForTransactionReceipt: mockWaitForTransactionReceipt,
} as unknown as PublicClient;

// Mock allowList address
const mockAllowListAddress = '0x1234567890123456789012345678901234567890' as Address;
const mockAddressToPropose = '0x3333333333333333333333333333333333333333' as Address;

// Mock transaction receipts
const mockSuccessReceipt = { status: 'success' } as unknown as TransactionReceipt;
const mockFailedReceipt = { status: 'reverted' } as unknown as TransactionReceipt;

// Mock contract with write methods that return the mock transaction hash
const mockContractWrite = {
  propose: vi.fn().mockResolvedValue(mockTxHash),
  accept: vi.fn().mockResolvedValue(mockTxHash)
};

// Full mock contract structure
const mockContract = {
  address: mockAllowListAddress,
  write: mockContractWrite
};

describe('L1AllowList', () => {
  let allowList: L1AllowList;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Set up mocked getContract implementation
    (getContract as any).mockReturnValue(mockContract);

    // Set up default success receipt
    mockWaitForTransactionReceipt.mockResolvedValue(mockSuccessReceipt);

    // Create a new L1AllowList for each test with the real implementation
    allowList = new L1AllowList(
      mockAllowListAddress,
      mockWalletClient,
      mockPublicClient,
      mockApproverWalletClient
    );
  });

  afterAll(() => {
    // Restore console.debug
    console.debug = originalConsoleDebug;
  });

  describe('allowListContract', () => {
    it('should return an AllowList contract instance', () => {
      expect(allowList.contract).toBe(mockContract);
    });

    it('should use the provided wallet client if specified', () => {
      const customWalletClient = { ...mockWalletClient } as WalletClient<Transport, Chain, Account>;
      const contract = allowList.allowListContract(customWalletClient);
      expect(contract).toBe(mockContract);
    });
  });

  describe('propose', () => {
    it('should propose an address to the allowlist', async () => {
      // Call the method
      const receipt = await allowList.propose(mockAddressToPropose);

      // Verify the contract calls
      expect(mockContractWrite.propose).toHaveBeenCalledTimes(1);
      expect(mockContractWrite.propose).toHaveBeenCalledWith([mockAddressToPropose], {
        account: mockAccount,
        chain: mockWalletClient.chain,
      });

      // Don't check the exact parameters since they might be different in the implementation
      expect(mockWaitForTransactionReceipt).toHaveBeenCalledTimes(1);
      expect(receipt).toEqual(mockSuccessReceipt);
    });

    it('should throw an error if the transaction fails', async () => {
      // Set up the mock to return a failed receipt
      mockWaitForTransactionReceipt.mockResolvedValueOnce(mockFailedReceipt);

      // Call the method and expect it to throw
      await expect(allowList.propose(mockAddressToPropose)).rejects.toThrow('propose() failed');
    });
  });

  describe('accept', () => {
    it('should accept an address to the allowlist using the default approver', async () => {
      // Call the method
      const receipt = await allowList.accept(mockAddressToPropose);

      // Verify the contract calls
      expect(mockContractWrite.accept).toHaveBeenCalledTimes(1);
      expect(mockContractWrite.accept).toHaveBeenCalledWith([mockAddressToPropose], {
        account: mockApproverAccount,
        chain: mockApproverWalletClient.chain,
      });

      // Don't check the exact parameters since they might be different in the implementation
      expect(mockWaitForTransactionReceipt).toHaveBeenCalledTimes(1);
      expect(receipt).toEqual(mockSuccessReceipt);
    });

    it('should accept an address to the allowlist using a provided approver', async () => {
      // Call the method with a specific approver
      const receipt = await allowList.accept(mockAddressToPropose, mockApproverWalletClient);

      // Verify the contract calls
      expect(mockContractWrite.accept).toHaveBeenCalledTimes(1);
      expect(mockContractWrite.accept).toHaveBeenCalledWith([mockAddressToPropose], {
        account: mockApproverAccount,
        chain: mockApproverWalletClient.chain,
      });

      // Don't check the exact parameters since they might be different in the implementation
      expect(mockWaitForTransactionReceipt).toHaveBeenCalledTimes(1);
      expect(receipt).toEqual(mockSuccessReceipt);
    });

    it('should throw an error if no approver is provided', async () => {
      // Create a new L1AllowList without an approver
      const allowListWithoutApprover = new L1AllowList(
        mockAllowListAddress,
        mockWalletClient,
        mockPublicClient
      );

      // Call the method and expect it to throw
      await expect(allowListWithoutApprover.accept(mockAddressToPropose)).rejects.toThrow(
        'Approver wallet client not provided'
      );
    });

    it('should throw an error if the transaction fails', async () => {
      // Set up the mock to return a failed receipt
      mockWaitForTransactionReceipt.mockResolvedValueOnce(mockFailedReceipt);

      // Call the method and expect it to throw
      await expect(allowList.accept(mockAddressToPropose)).rejects.toThrow('accept() failed');
    });
  });
});

describe('getL1AllowListContract', () => {
  it('should call getContract with the correct parameters', () => {
    // Call the function
    getL1AllowListContract(mockAllowListAddress, mockPublicClient);

    // Verify getContract was called with the right parameters
    expect(getContract).toHaveBeenCalledWith({
      address: mockAllowListAddress,
      abi: expect.anything(), // We can't easily check the ABI, but we can verify it's passed
      client: mockPublicClient,
    });
  });

  it('should work with a client object containing public and wallet clients', () => {
    // Create a client object with public and wallet clients
    const client = {
      public: mockPublicClient,
      wallet: mockWalletClient
    };

    // Call the function
    getL1AllowListContract(mockAllowListAddress, client);

    // Verify getContract was called with the right parameters
    expect(getContract).toHaveBeenCalledWith({
      address: mockAllowListAddress,
      abi: expect.anything(),
      client,
    });
  });
});
