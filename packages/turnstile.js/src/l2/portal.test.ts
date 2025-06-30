import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  Fr,
  EthAddress,
  AztecAddress,
  type AztecNode,
  type PXE,
  type Wallet,
} from '@aztec/aztec.js';
import { PortalContract } from '@turnstile-portal/aztec-artifacts';
import { L2Portal } from './portal.js';
import type { IL2Client } from './client.js';

// Mock the imports
vi.mock('@aztec/aztec.js');
vi.mock('@turnstile-portal/aztec-artifacts');

describe('L2Portal', () => {
  let portal: L2Portal;
  let mockL2Client: IL2Client;
  let mockAztecNode: AztecNode & {
    getBlockNumber: ReturnType<typeof vi.fn>;
    getL1ToL2MessageMembershipWitness: ReturnType<typeof vi.fn>;
  };
  let mockPxe: PXE;
  let mockWallet: Wallet;
  let portalAddr: AztecAddress;
  // biome-ignore lint/suspicious/noExplicitAny: Using any for test mocks is acceptable
  let mockPortalContract: any;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Setup mock AztecAddress
    portalAddr = {
      toString: () => '0x1234567890123456789012345678901234567890',
    } as unknown as AztecAddress;
    const walletAddr = {
      toString: () => '0x2345678901234567890123456789012345678901',
    } as unknown as AztecAddress;

    // Mock EthAddress.fromString
    vi.mocked(EthAddress.fromString).mockImplementation(
      (addr) =>
        ({
          toString: () => addr,
        }) as unknown as EthAddress,
    );

    // Mock Portal Contract methods with the correct method names
    mockPortalContract = {
      methods: {
        get_config_public: vi.fn().mockReturnValue({
          simulate: vi.fn().mockResolvedValue({
            l1_portal: {
              inner: BigInt('0x3456789012345678901234567890123456789012'),
            },
            shield_gateway: {
              toString: () => '0x4567890123456789012345678901234567890123',
            },
            token_contract_class_id: {
              inner: BigInt('0x5678901234567890123456789012345678901234'),
            },
          }),
        }),
        get_l2_token_unconstrained: vi.fn().mockReturnValue({
          simulate: vi
            .fn()
            .mockResolvedValue(
              BigInt('0x4567890123456789012345678901234567890123'),
            ),
        }),
        get_l1_token_unconstrained: vi.fn().mockReturnValue({
          simulate: vi.fn().mockResolvedValue({
            inner: BigInt('0x5678901234567890123456789012345678901234'),
          }),
        }),
        is_registered_l1_unconstrained: vi.fn().mockReturnValue({
          simulate: vi.fn().mockResolvedValue(true),
        }),
        is_registered_l2_unconstrained: vi.fn().mockReturnValue({
          simulate: vi.fn().mockResolvedValue(false),
        }),
        claim_public: vi.fn().mockReturnValue({
          send: vi.fn().mockResolvedValue({ txHash: '0xabcd' }),
        }),
        claim_shielded: vi.fn().mockReturnValue({
          send: vi.fn().mockResolvedValue({ txHash: '0xbcde' }),
        }),
        register_private: vi.fn().mockReturnValue({
          send: vi.fn().mockResolvedValue({ txHash: '0xcdef' }),
        }),
        withdraw_public: vi.fn().mockReturnValue({
          send: vi.fn().mockResolvedValue({ txHash: '0xdefg' }),
        }),
      },
    };

    vi.mocked(PortalContract.at).mockResolvedValue(mockPortalContract);

    // Mock the AztecNode with proper mock functions
    mockAztecNode = {
      getBlockNumber: vi.fn().mockResolvedValue(10),
      getL1ToL2MessageMembershipWitness: vi.fn().mockResolvedValue(null),
      getNodeInfo: vi.fn().mockResolvedValue({
        l1ChainId: 1,
      }),
    } as unknown as AztecNode & {
      getBlockNumber: ReturnType<typeof vi.fn>;
      getL1ToL2MessageMembershipWitness: ReturnType<typeof vi.fn>;
    };

    mockPxe = {} as unknown as PXE;

    // Mock the wallet
    mockWallet = {
      getAddress: vi.fn().mockReturnValue(walletAddr),
    } as unknown as Wallet;

    // Mock the L2Client
    mockL2Client = {
      getNode: vi.fn().mockReturnValue(mockAztecNode),
      getWallet: vi.fn().mockReturnValue(mockWallet),
      getAddress: vi.fn().mockReturnValue(walletAddr),
    };

    // Mock EthAddress.fromField to return proper EthAddress objects
    vi.mocked(EthAddress.fromField).mockImplementation(
      () =>
        ({
          toString: () => '0x3456789012345678901234567890123456789012',
        }) as unknown as EthAddress,
    );

    // Mock AztecAddress.fromBigInt to return proper AztecAddress objects
    vi.mocked(AztecAddress.fromBigInt).mockImplementation(
      () =>
        ({
          toString: () => '0x4567890123456789012345678901234567890123',
        }) as unknown as AztecAddress,
    );

    // Create portal instance
    portal = new L2Portal(portalAddr, mockL2Client);
  });

  describe('constructor and getAddress', () => {
    it('should create a portal instance and return the correct address', () => {
      expect(portal).toBeInstanceOf(L2Portal);
      expect(portal.getAddress()).toBe(portalAddr);
    });
  });

  describe('getL1Portal', () => {
    it('should return the L1 portal address', async () => {
      const result = await portal.getL1Portal();

      // Verify the portal contract was retrieved
      expect(PortalContract.at).toHaveBeenCalledWith(portalAddr, mockWallet);

      // Verify the get_config_public method was called
      expect(mockPortalContract.methods.get_config_public).toHaveBeenCalled();
      expect(
        mockPortalContract.methods.get_config_public().simulate,
      ).toHaveBeenCalled();

      // Verify the result matches the mock
      expect(result.toString()).toBe(
        '0x3456789012345678901234567890123456789012',
      );
    });

    it('should throw an error when contract interaction fails', async () => {
      // Setup error case
      mockPortalContract.methods
        .get_config_public()
        .simulate.mockRejectedValueOnce(new Error('Simulation failed'));

      // Verify error is thrown
      await expect(portal.getL1Portal()).rejects.toThrow();
    });
  });

  describe('claimDeposit', () => {
    const l1TokenAddr = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const l2RecipientAddr = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const amount = BigInt(1000);
    const index = BigInt(123);

    it('should claim a deposit to public balance', async () => {
      // Mock the Fr.fromHexString return value
      vi.mocked(Fr.fromHexString).mockImplementation(
        (hex) =>
          ({
            toString: () => `fr_${hex}`,
          }) as unknown as Fr,
      );

      const tx = await portal.claimDeposit(
        l1TokenAddr,
        l2RecipientAddr,
        amount,
        index,
      );

      // Check the portal contract was retrieved
      expect(PortalContract.at).toHaveBeenCalledWith(portalAddr, mockWallet);

      // Check EthAddress and AztecAddress conversion
      expect(EthAddress.fromString).toHaveBeenCalledWith(l1TokenAddr);
      expect(AztecAddress.fromString).toHaveBeenCalledWith(l2RecipientAddr);

      // Check Fr conversion for index
      expect(Fr.fromHexString).toHaveBeenCalledWith(`0x${index.toString(16)}`);

      // Check claim_public method was called with correct params
      expect(mockPortalContract.methods.claim_public).toHaveBeenCalled();
      expect(mockPortalContract.methods.claim_public().send).toHaveBeenCalled();

      // Check the returned transaction
      expect(tx).toEqual({ txHash: '0xabcd' });
    });

    it('should throw an error when claim_public fails', async () => {
      // Setup error case
      mockPortalContract.methods
        .claim_public()
        .send.mockRejectedValueOnce(new Error('Claim failed'));

      // Verify error is thrown
      await expect(
        portal.claimDeposit(l1TokenAddr, l2RecipientAddr, amount, index),
      ).rejects.toThrow();
    });
  });

  describe('claimDepositShielded', () => {
    const l1TokenAddr = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const l2RecipientAddr = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const amount = BigInt(1000);
    const index = BigInt(123);

    it('should claim a deposit to private balance', async () => {
      // Mock the Fr.fromHexString return value
      vi.mocked(Fr.fromHexString).mockImplementation(
        (hex) =>
          ({
            toString: () => `fr_${hex}`,
          }) as unknown as Fr,
      );

      const tx = await portal.claimDepositShielded(
        l1TokenAddr,
        l2RecipientAddr,
        amount,
        index,
      );

      // Check the portal contract was retrieved
      expect(PortalContract.at).toHaveBeenCalledWith(portalAddr, mockWallet);

      // Check EthAddress and AztecAddress conversion
      expect(EthAddress.fromString).toHaveBeenCalledWith(l1TokenAddr);
      expect(AztecAddress.fromString).toHaveBeenCalledWith(l2RecipientAddr);

      // Check Fr conversion for index
      expect(Fr.fromHexString).toHaveBeenCalledWith(`0x${index.toString(16)}`);

      // Check claim_shielded method was called with correct params
      expect(mockPortalContract.methods.claim_shielded).toHaveBeenCalled();
      expect(
        mockPortalContract.methods.claim_shielded().send,
      ).toHaveBeenCalled();

      // Check the returned transaction
      expect(tx).toEqual({ txHash: '0xbcde' });
    });

    it('should throw an error when claim_shielded fails', async () => {
      // Setup error case
      mockPortalContract.methods
        .claim_shielded()
        .send.mockRejectedValueOnce(new Error('Claim failed'));

      // Verify error is thrown
      await expect(
        portal.claimDepositShielded(
          l1TokenAddr,
          l2RecipientAddr,
          amount,
          index,
        ),
      ).rejects.toThrow();
    });
  });

  describe('isClaimed', () => {
    const l2BlockNumber = 5;
    const hash =
      '0x1234567890123456789012345678901234567890123456789012345678901234';

    it('should return false when block number is higher than current', async () => {
      // Mock getBlockNumber to return a lower number
      mockAztecNode.getBlockNumber.mockResolvedValueOnce(3);

      const result = await portal.isClaimed(l2BlockNumber, hash);

      expect(result).toBe(false);
    });

    it('should return false when message witness is found', async () => {
      // Mock getBlockNumber to return a higher number
      mockAztecNode.getBlockNumber.mockResolvedValueOnce(10);

      // Mock getL1ToL2MessageMembershipWitness to return a witness
      mockAztecNode.getL1ToL2MessageMembershipWitness.mockResolvedValueOnce([
        BigInt(1),
        [BigInt(1), BigInt(2), BigInt(3)],
      ]);

      const result = await portal.isClaimed(l2BlockNumber, hash);

      expect(result).toBe(false);
    });

    it('should return true when message witness is not found', async () => {
      // Mock getBlockNumber to return a higher number
      mockAztecNode.getBlockNumber.mockResolvedValueOnce(10);

      // Mock getL1ToL2MessageMembershipWitness to return null
      mockAztecNode.getL1ToL2MessageMembershipWitness.mockResolvedValueOnce(
        null,
      );

      const result = await portal.isClaimed(l2BlockNumber, hash);

      expect(result).toBe(true);
    });

    it('should throw an error when check fails', async () => {
      // Mock getBlockNumber to throw an error
      mockAztecNode.getBlockNumber.mockRejectedValueOnce(
        new Error('Block number check failed'),
      );

      // Verify error is thrown
      await expect(portal.isClaimed(l2BlockNumber, hash)).rejects.toThrow();
    });
  });

  describe('registerToken', () => {
    const l1TokenAddr = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const l2TokenAddr = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const name = 'Test Token';
    const symbol = 'TST';
    const decimals = 18;
    const index = BigInt(123);

    it('should register a token', async () => {
      // Mock the Fr.fromHexString return value
      vi.mocked(Fr.fromHexString).mockImplementation(
        (hex) =>
          ({
            toString: () => `fr_${hex}`,
          }) as unknown as Fr,
      );

      const tx = await portal.registerToken(
        l1TokenAddr,
        l2TokenAddr,
        name,
        symbol,
        decimals,
        index,
      );

      // Check the portal contract was retrieved
      expect(PortalContract.at).toHaveBeenCalledWith(portalAddr, mockWallet);

      // Check EthAddress and AztecAddress conversion
      expect(EthAddress.fromString).toHaveBeenCalledWith(l1TokenAddr);
      expect(AztecAddress.fromString).toHaveBeenCalledWith(l2TokenAddr);

      // Check Fr conversion for index
      expect(Fr.fromHexString).toHaveBeenCalledWith(`0x${index.toString(16)}`);

      // Check register_private method was called with correct params
      expect(mockPortalContract.methods.register_private).toHaveBeenCalled();
      expect(
        mockPortalContract.methods.register_private().send,
      ).toHaveBeenCalled();

      // Check the returned transaction
      expect(tx).toEqual({ txHash: '0xcdef' });
    });

    it('should throw an error when register_private fails', async () => {
      // Setup error case
      mockPortalContract.methods
        .register_private()
        .send.mockRejectedValueOnce(new Error('Register failed'));

      // Verify error is thrown
      await expect(
        portal.registerToken(
          l1TokenAddr,
          l2TokenAddr,
          name,
          symbol,
          decimals,
          index,
        ),
      ).rejects.toThrow();
    });
  });

  describe('withdrawPublic', () => {
    const l1TokenAddr = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const l1RecipientAddr = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const amount = BigInt(1000);
    const burnNonce = Fr.fromHexString(
      '0x1234567890123456789012345678901234567890123456789012345678901234',
    );

    it('should withdraw tokens and return transaction and leaf', async () => {
      // Mock the Fr.fromHexString return value for the leaf
      vi.mocked(Fr.fromHexString).mockImplementation(
        (hex) =>
          ({
            toString: () => `fr_${hex}`,
          }) as unknown as Fr,
      );

      const result = await portal.withdrawPublic(
        l1TokenAddr,
        l1RecipientAddr,
        amount,
        burnNonce,
      );

      // Check the portal contract was retrieved
      expect(PortalContract.at).toHaveBeenCalledWith(portalAddr, mockWallet);

      // Check EthAddress conversion
      expect(EthAddress.fromString).toHaveBeenCalledWith(l1TokenAddr);
      expect(EthAddress.fromString).toHaveBeenCalledWith(l1RecipientAddr);

      // Check withdraw_public method was called with correct params
      expect(mockPortalContract.methods.withdraw_public).toHaveBeenCalled();
      expect(
        mockPortalContract.methods.withdraw_public().send,
      ).toHaveBeenCalled();

      // Check the returned transaction
      expect(result.tx).toEqual({ txHash: '0xdefg' });
      expect(result.leaf).toBeDefined();
    });

    it('should throw an error when withdraw_public fails', async () => {
      // Setup error case
      mockPortalContract.methods
        .withdraw_public()
        .send.mockRejectedValueOnce(new Error('Withdraw failed'));

      // Verify error is thrown
      await expect(
        portal.withdrawPublic(l1TokenAddr, l1RecipientAddr, amount, burnNonce),
      ).rejects.toThrow();
    });
  });

  describe('Complete integration tests and helper function coverage', () => {
    it('should mock the full portal creation process', async () => {
      // Test the getL1Portal method which internally calls getConfig
      const result = await portal.getL1Portal();

      // Verify the result
      expect(result.toString()).toBe(
        '0x3456789012345678901234567890123456789012',
      );
    });

    it('should test encodeWithdrawData through accessing the private method', async () => {
      // Access the private method through the instance
      const encodeWithdrawData = (
        portal as unknown as {
          encodeWithdrawData: (
            l1TokenAddr: string,
            l1RecipientAddr: string,
            amount: bigint,
          ) => string;
        }
      ).encodeWithdrawData;

      const l1TokenAddr = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const l1RecipientAddr = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      const amount = BigInt(1000);

      const result = encodeWithdrawData(l1TokenAddr, l1RecipientAddr, amount);

      // Verify the result is a hex string
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^0x/);
    });

    it.skip('should try more edge cases of withdrawPublic and message handling', async () => {
      // This test is skipped as it requires more complex mocking
      // of the L2ToL1Message leaf calculation
    });

    it('should test getL1ToL2MessageLeafIndex when message witness is not found', async () => {
      // Mock getL1ToL2MessageMembershipWitness to return null
      mockAztecNode.getL1ToL2MessageMembershipWitness.mockResolvedValueOnce(
        null,
      );

      // Access the private method through the instance
      const getL1ToL2MessageLeafIndex = (
        portal as unknown as {
          getL1ToL2MessageLeafIndex: (hash: string) => Promise<bigint>;
        }
      ).getL1ToL2MessageLeafIndex;

      const hash =
        '0x1234567890123456789012345678901234567890123456789012345678901234';

      // Verify error is thrown when witness is not found
      await expect(getL1ToL2MessageLeafIndex(hash)).rejects.toThrow();
    });
  });

  describe('getL2Token and getL1Token', () => {
    const l1TokenAddr = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const l2TokenAddr = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

    it('should return L2 token for L1 token', async () => {
      const result = await portal.getL2Token(l1TokenAddr);

      // Check the portal contract was retrieved
      expect(PortalContract.at).toHaveBeenCalledWith(portalAddr, mockWallet);

      // Check EthAddress conversion
      expect(EthAddress.fromString).toHaveBeenCalledWith(l1TokenAddr);

      // Check get_l2_token_unconstrained method was called
      expect(
        mockPortalContract.methods.get_l2_token_unconstrained,
      ).toHaveBeenCalled();
      expect(
        mockPortalContract.methods.get_l2_token_unconstrained().simulate,
      ).toHaveBeenCalled();

      // Check the returned address
      expect(result.toString()).toBe(
        '0x4567890123456789012345678901234567890123',
      );
    });

    it('should throw an error when get_l2_token_unconstrained fails', async () => {
      // Setup error case
      mockPortalContract.methods
        .get_l2_token_unconstrained()
        .simulate.mockRejectedValueOnce(new Error('Get L2 token failed'));

      // Verify error is thrown
      await expect(portal.getL2Token(l1TokenAddr)).rejects.toThrow();
    });

    it('should return L1 token for L2 token', async () => {
      const result = await portal.getL1Token(l2TokenAddr);

      // Check the portal contract was retrieved
      expect(PortalContract.at).toHaveBeenCalledWith(portalAddr, mockWallet);

      // Check AztecAddress conversion
      expect(AztecAddress.fromString).toHaveBeenCalledWith(l2TokenAddr);

      // Check get_l1_token_unconstrained method was called
      expect(
        mockPortalContract.methods.get_l1_token_unconstrained,
      ).toHaveBeenCalled();
      expect(
        mockPortalContract.methods.get_l1_token_unconstrained().simulate,
      ).toHaveBeenCalled();

      // Check the returned address
      expect(result.toString()).toBe(
        '0x5678901234567890123456789012345678901234',
      );
    });

    it('should throw an error when get_l1_token_unconstrained fails', async () => {
      // Setup error case
      mockPortalContract.methods
        .get_l1_token_unconstrained()
        .simulate.mockRejectedValueOnce(new Error('Get L1 token failed'));

      // Verify error is thrown
      await expect(portal.getL1Token(l2TokenAddr)).rejects.toThrow();
    });
  });

  describe('isRegisteredByL1Address and isRegisteredByL2Address', () => {
    const l1TokenAddr = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const l2TokenAddr = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

    it('should check if token is registered by L1 address', async () => {
      const result = await portal.isRegisteredByL1Address(l1TokenAddr);

      // Check the portal contract was retrieved
      expect(PortalContract.at).toHaveBeenCalledWith(portalAddr, mockWallet);

      // Check EthAddress conversion
      expect(EthAddress.fromString).toHaveBeenCalledWith(l1TokenAddr);

      // Check is_registered_l1_unconstrained method was called
      expect(
        mockPortalContract.methods.is_registered_l1_unconstrained,
      ).toHaveBeenCalled();
      expect(
        mockPortalContract.methods.is_registered_l1_unconstrained().simulate,
      ).toHaveBeenCalled();

      // Check the returned boolean
      expect(result).toBe(true);
    });

    it('should throw an error when is_registered_l1_unconstrained fails', async () => {
      // Setup error case
      mockPortalContract.methods
        .is_registered_l1_unconstrained()
        .simulate.mockRejectedValueOnce(new Error('Check registration failed'));

      // Verify error is thrown
      await expect(
        portal.isRegisteredByL1Address(l1TokenAddr),
      ).rejects.toThrow();
    });

    it('should check if token is registered by L2 address', async () => {
      const result = await portal.isRegisteredByL2Address(l2TokenAddr);

      // Check the portal contract was retrieved
      expect(PortalContract.at).toHaveBeenCalledWith(portalAddr, mockWallet);

      // Check AztecAddress conversion
      expect(AztecAddress.fromString).toHaveBeenCalledWith(l2TokenAddr);

      // Check is_registered_l2_unconstrained method was called
      expect(
        mockPortalContract.methods.is_registered_l2_unconstrained,
      ).toHaveBeenCalled();
      expect(
        mockPortalContract.methods.is_registered_l2_unconstrained().simulate,
      ).toHaveBeenCalled();

      // Check the returned boolean
      expect(result).toBe(false);
    });

    it('should throw an error when is_registered_l2_unconstrained fails', async () => {
      // Setup error case
      mockPortalContract.methods
        .is_registered_l2_unconstrained()
        .simulate.mockRejectedValueOnce(new Error('Check registration failed'));

      // Verify error is thrown
      await expect(
        portal.isRegisteredByL2Address(l2TokenAddr),
      ).rejects.toThrow();
    });
  });
});
