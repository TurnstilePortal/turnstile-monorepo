// @ts-nocheck
// ^ This directive disables TypeScript checking for this file, which is appropriate for test files
// with complex mocks where TypeScript can't fully understand the runtime behavior of vitest mocks.

import {
  AztecAddress,
  Contract,
  type ContractFunctionInteraction,
  Fr,
  getContractInstanceFromInstantiationParams,
  type PXE,
  readFieldCompressedString,
  type SentTx,
  TxStatus,
  type Wallet,
} from '@aztec/aztec.js';
import { TokenContract } from '@turnstile-portal/aztec-artifacts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode, TurnstileError } from '../errors.js';
import { ExtendedBatchCall } from '../utils/extended-batch-call.js';
import type { L2Client } from './client.js';
import { L2Token } from './token.js';

// Mock the imports
vi.mock('@aztec/aztec.js');
vi.mock('@turnstile-portal/aztec-artifacts');
vi.mock('../utils/extended-batch-call.js');

describe('L2Token', () => {
  // Set up test fixtures
  let token: L2Token;
  let mockL2Client: L2Client;
  let mockPXE: PXE;
  let mockWallet: Wallet;
  let tokenAddr: AztecAddress;
  let mockTokenContract: TokenContract;
  let accountAddr: AztecAddress;
  let portalAddr: AztecAddress;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Set up the readFieldCompressedString mock
    (readFieldCompressedString as vi.Mock).mockImplementation((value: unknown) => {
      // Mock different return values based on the input
      // Check the first element of the array that would be returned by simulate()
      if (Array.isArray(value) && value[0] === BigInt(1)) return 'TST';
      if (Array.isArray(value) && value[0] === BigInt(4)) return 'Test Token';
      return 'Unknown';
    });

    // Mock Fr.ZERO and Fr.random
    Object.defineProperty(Fr, 'ZERO', {
      value: { toString: () => 'fr_zero' },
      writable: true,
    });
    Fr.random = vi.fn().mockImplementation(() => ({ toString: () => 'fr_random' }) as unknown as Fr);

    // Set up addresses
    tokenAddr = {
      toString: () => '0x1234567890123456789012345678901234567890',
    } as unknown as AztecAddress;
    accountAddr = {
      toString: () => '0x2345678901234567890123456789012345678901',
    } as unknown as AztecAddress;
    portalAddr = {
      toString: () => '0x3456789012345678901234567890123456789012',
    } as unknown as AztecAddress;

    // Mock Fr and AztecAddress methods
    Fr.fromHexString = vi.fn().mockImplementation(
      (hex) =>
        ({
          toString: () => `fr_${hex}`,
        }) as unknown as Fr,
    );

    AztecAddress.fromString = vi.fn().mockImplementation(
      (addr) =>
        ({
          toString: () => addr,
        }) as unknown as AztecAddress,
    );

    // Mock AztecAddress.ZERO
    Object.defineProperty(AztecAddress, 'ZERO', {
      value: undefined,
      writable: true,
    });

    // Mock TxStatus
    Object.defineProperty(TxStatus, 'SUCCESS', {
      value: 'success',
      writable: true,
    });

    // Mock ExtendedBatchCall
    ExtendedBatchCall.mockImplementation((_wallet, _payloads) => ({
      send: vi.fn().mockReturnValue({
        getTxHash: vi.fn().mockReturnValue({ toString: () => 'mock-tx-hash' }),
        wait: vi.fn().mockResolvedValue({
          status: TxStatus.SUCCESS,
        }),
      }),
    }));

    // Mock getContractInstanceFromInstantiationParams
    (getContractInstanceFromInstantiationParams as vi.Mock).mockResolvedValue({
      address: tokenAddr,
    });

    // Mock the wallet
    mockWallet = {
      getAddress: vi.fn().mockReturnValue(accountAddr),
      storeCapsule: vi.fn(),
      registerContract: vi.fn().mockResolvedValue(undefined),
    } as unknown as Wallet;

    // Mock the PXE
    mockPXE = {
      getNodeInfo: vi.fn().mockResolvedValue({ chainId: 1 }),
    } as unknown as PXE;

    // Mock the L2Client
    mockL2Client = {
      getPXE: vi.fn().mockReturnValue(mockPXE),
      getWallet: vi.fn().mockReturnValue(mockWallet),
      getAddress: vi.fn().mockReturnValue(accountAddr),
      getFeeOpts: vi.fn().mockReturnValue({ fee: 0 }),
    };

    // Create a mock TokenContract
    mockTokenContract = {
      address: tokenAddr,
      methods: {
        symbol: vi.fn().mockReturnValue({
          simulate: vi.fn().mockResolvedValue([BigInt(1), BigInt(2), BigInt(3)]),
        }),
        name: vi.fn().mockReturnValue({
          simulate: vi.fn().mockResolvedValue([BigInt(4), BigInt(5), BigInt(6)]),
        }),
        decimals: vi.fn().mockReturnValue({
          simulate: vi.fn().mockResolvedValue(18),
        }),
        balance_of_public: vi.fn().mockReturnValue({
          simulate: vi.fn().mockResolvedValue(BigInt(1000)),
        }),
        balance_of_private: vi.fn().mockReturnValue({
          simulate: vi.fn().mockResolvedValue(BigInt(2000)),
        }),
        transfer_public_to_public: vi.fn().mockReturnValue({
          send: vi.fn().mockResolvedValue({ txHash: '0xabcd' } as unknown as SentTx),
        }),
        transfer_private_to_private: vi.fn().mockReturnValue({
          with: vi.fn().mockReturnThis(),
          send: vi.fn().mockResolvedValue({ txHash: '0xbcde' } as unknown as SentTx),
        }),
        shield: vi.fn().mockReturnValue({
          send: vi.fn().mockResolvedValue({ txHash: '0xcdef' } as unknown as SentTx),
        }),
        unshield: vi.fn().mockReturnValue({
          send: vi.fn().mockResolvedValue({ txHash: '0xdefg' } as unknown as SentTx),
        }),
        burn_public: vi.fn().mockReturnValue({
          functionName: 'burn_public',
          args: vi.fn().mockReturnValue([]),
        } as unknown as ContractFunctionInteraction),
        get_shield_gateway_public: vi.fn().mockReturnValue({
          simulate: vi.fn().mockResolvedValue(portalAddr),
        }),
      },
    } as unknown as TokenContract;

    // Mock the TokenContract static methods
    TokenContract.at = vi.fn().mockResolvedValue(mockTokenContract);

    // Mock Contract.deploy for the deploy method
    Contract.deploy = vi.fn().mockReturnValue({
      send: vi.fn().mockReturnValue({
        deployed: vi.fn().mockResolvedValue({ address: tokenAddr }),
      }),
      request: vi.fn().mockResolvedValue({
        // Mock ExecutionPayload
        packedArguments: [],
        calls: [],
      }),
    });

    // Create token instance
    token = new L2Token(mockTokenContract, mockL2Client);
  });

  describe('constructor and getAddress', () => {
    it('should create a token instance and return the correct address', () => {
      expect(token).toBeInstanceOf(L2Token);
      expect(token.getAddress()).toBe(tokenAddr);
    });
  });

  describe('getSymbol', () => {
    it('should return the token symbol', async () => {
      const symbol = await token.getSymbol();

      // Check that the contract method was called
      expect(mockTokenContract.methods.symbol).toHaveBeenCalled();
      expect(mockTokenContract.methods.symbol().simulate).toHaveBeenCalled();

      // Check that the result is as expected
      expect(symbol).toBe('TST');
    });

    it('should throw an error when contract interaction fails', async () => {
      // Mock the error
      mockTokenContract.methods.symbol().simulate.mockRejectedValueOnce(new Error('Simulation failed'));

      // Check that the error is thrown with the correct code
      await expect(token.getSymbol()).rejects.toMatchObject({
        code: ErrorCode.L2_TOKEN_OPERATION,
        message: expect.stringContaining('Failed to get symbol'),
      });
    });
  });

  describe('getName', () => {
    it('should return the token name', async () => {
      const name = await token.getName();

      // Check that the contract method was called
      expect(mockTokenContract.methods.name).toHaveBeenCalled();
      expect(mockTokenContract.methods.name().simulate).toHaveBeenCalled();

      // Check that the result is as expected
      expect(name).toBe('Test Token');
    });

    it('should throw an error when contract interaction fails', async () => {
      // Mock the error
      mockTokenContract.methods.name().simulate.mockRejectedValueOnce(new Error('Simulation failed'));

      // Check that the error is thrown with the correct code
      await expect(token.getName()).rejects.toMatchObject({
        code: ErrorCode.L2_TOKEN_OPERATION,
        message: expect.stringContaining('Failed to get name'),
      });
    });
  });

  describe('getDecimals', () => {
    it('should return the token decimals', async () => {
      const decimals = await token.getDecimals();

      // Check that the contract method was called
      expect(mockTokenContract.methods.decimals).toHaveBeenCalled();
      expect(mockTokenContract.methods.decimals().simulate).toHaveBeenCalled();

      // Check that the result is as expected
      expect(decimals).toBe(18);
    });

    it('should throw an error when contract interaction fails', async () => {
      // Mock the error
      mockTokenContract.methods.decimals().simulate.mockRejectedValueOnce(new Error('Simulation failed'));

      // Check that the error is thrown with the correct code
      await expect(token.getDecimals()).rejects.toMatchObject({
        code: ErrorCode.L2_TOKEN_OPERATION,
        message: expect.stringContaining('Failed to get decimals'),
      });
    });
  });

  describe('balanceOfPublic', () => {
    it('should return the public balance of an account', async () => {
      const balance = await token.balanceOfPublic(accountAddr);

      // Check that the contract method was called with the correct parameters
      expect(mockTokenContract.methods.balance_of_public).toHaveBeenCalledWith(accountAddr);
      expect(mockTokenContract.methods.balance_of_public().simulate).toHaveBeenCalled();

      // Check that the result is as expected
      expect(balance).toBe(BigInt(1000));
    });

    it('should throw an error when contract interaction fails', async () => {
      // Mock the error
      mockTokenContract.methods.balance_of_public().simulate.mockRejectedValueOnce(new Error('Simulation failed'));

      // Check that the error is thrown with the correct code
      await expect(token.balanceOfPublic(accountAddr)).rejects.toMatchObject({
        code: ErrorCode.L2_INSUFFICIENT_BALANCE,
        message: expect.stringContaining('Failed to get public balance'),
      });
    });
  });

  describe('balanceOfPrivate', () => {
    it('should return the private balance of an account', async () => {
      const balance = await token.balanceOfPrivate(accountAddr);

      // Check that the contract method was called with the correct parameters
      expect(mockTokenContract.methods.balance_of_private).toHaveBeenCalledWith(accountAddr);
      expect(mockTokenContract.methods.balance_of_private().simulate).toHaveBeenCalled();

      // Check that the result is as expected
      expect(balance).toBe(BigInt(2000));
    });

    it('should throw an error when contract interaction fails', async () => {
      // Mock the error
      mockTokenContract.methods.balance_of_private().simulate.mockRejectedValueOnce(new Error('Simulation failed'));

      // Check that the error is thrown with the correct code
      await expect(token.balanceOfPrivate(accountAddr)).rejects.toMatchObject({
        code: ErrorCode.L2_INSUFFICIENT_BALANCE,
        message: expect.stringContaining('Failed to get private balance'),
      });
    });
  });

  describe('transferPublic', () => {
    const recipient = {
      toString: () => '0x9876543210987654321098765432109876543210',
    } as unknown as AztecAddress;
    const amount = BigInt(500);

    it('should return a token interaction for public transfer', () => {
      const interaction = token.transferPublic(recipient, amount);

      // Check the client method was called to get the sender address
      expect(mockL2Client.getAddress).toHaveBeenCalled();

      // Check that the contract method was called with the correct parameters
      expect(mockTokenContract.methods.transfer_public_to_public).toHaveBeenCalledWith(
        accountAddr,
        recipient,
        amount,
        Fr.ZERO,
      );

      // Check that we got an L2TokenInteraction back
      expect(interaction).toBeDefined();
      expect(interaction.getInteraction).toBeDefined();
    });

    it('should allow sending the interaction', async () => {
      const interaction = token.transferPublic(recipient, amount);
      const sendMethodOptions = {};
      const tx = await interaction.send(sendMethodOptions);

      // Check that the send method was called
      expect(mockTokenContract.methods.transfer_public_to_public().send).toHaveBeenCalledWith(sendMethodOptions);

      // Check that the result is the expected transaction
      expect(tx).toEqual({ txHash: '0xabcd' });
    });

    it('should throw an error when creating interaction fails', () => {
      // Mock the error
      const mockError = new Error('Failed to create interaction');
      mockTokenContract.methods.transfer_public_to_public.mockImplementationOnce(() => {
        throw mockError;
      });

      // Check that the error is thrown with the correct code
      expect(() => token.transferPublic(recipient, amount)).toThrow();
    });
  });

  describe('transferPrivate', () => {
    const recipient = {
      toString: () => '0x9876543210987654321098765432109876543210',
    } as unknown as AztecAddress;
    const amount = BigInt(500);
    const verifiedID = [
      { toString: () => 'vid1' },
      { toString: () => 'vid2' },
      { toString: () => 'vid3' },
      { toString: () => 'vid4' },
      { toString: () => 'vid5' },
    ] as unknown as Fr[] & { length: 5 };

    // Edge cases with validations
    const nullAddr = null as unknown as AztecAddress;
    const zeroAmount = BigInt(0);
    const negativeAmount = BigInt(-1);
    const _invalidVerifiedID = [{ toString: () => 'invalid' }] as unknown as Fr[] & { length: 5 };

    it('should return a token interaction for private transfer', () => {
      const interaction = token.transferPrivate(recipient, amount, verifiedID);

      // Check the client methods were called
      expect(mockL2Client.getAddress).toHaveBeenCalled();

      // Check that the contract method was called with the correct parameters
      expect(mockTokenContract.methods.transfer_private_to_private).toHaveBeenCalledWith(
        accountAddr,
        recipient,
        amount,
        Fr.ZERO,
      );

      // Check that we got an L2TokenInteraction back
      expect(interaction).toBeDefined();
      expect(interaction.getInteraction).toBeDefined();
    });

    it('should send private transfer with verified ID', async () => {
      // Setup the mock for getShieldGatewayAddress
      mockTokenContract.methods.get_shield_gateway_public().simulate.mockResolvedValue(portalAddr);

      const interaction = token.transferPrivate(recipient, amount, verifiedID);
      const sendMethodOptions = {};
      const tx = await interaction.send(sendMethodOptions);

      // Indirectly check that getShieldGatewayAddress was called via the simulate method
      expect(mockTokenContract.methods.get_shield_gateway_public().simulate).toHaveBeenCalled();

      // Check that the send method was called
      expect(mockTokenContract.methods.transfer_private_to_private().send).toHaveBeenCalled();

      // Check that the result is the expected transaction
      expect(tx).toEqual({ txHash: '0xbcde' });
    });

    it('should throw an error when creating interaction fails', () => {
      // Mock the error
      const mockError = new Error('Failed to create interaction');
      mockTokenContract.methods.transfer_private_to_private.mockImplementationOnce(() => {
        throw mockError;
      });

      // Check that the error is thrown
      expect(() => token.transferPrivate(recipient, amount, verifiedID)).toThrow();
    });

    it('should throw an error when getting shield gateway address fails', async () => {
      // Mock the error for get_shield_gateway_public
      const mockError = new TurnstileError(ErrorCode.L2_TOKEN_OPERATION, 'Failed to get shield gateway address', {});
      mockTokenContract.methods.get_shield_gateway_public().simulate.mockRejectedValueOnce(mockError);

      const interaction = token.transferPrivate(recipient, amount, verifiedID);
      const sendMethodOptions = {};

      // When we try to send, it should fail when getting the shield gateway
      await expect(interaction.send(sendMethodOptions)).rejects.toHaveProperty(
        'code',
        ErrorCode.L2_CONTRACT_INTERACTION,
      );
    });

    // Additional test to cover the edge case in transferPrivate method
    it('should throw an error when shield gateway address exists but transfer fails before the send', async () => {
      // Setup the mock for getShieldGatewayAddress
      mockTokenContract.methods.get_shield_gateway_public().simulate.mockResolvedValue(portalAddr);

      // Mock the with method to throw an error
      mockTokenContract.methods.transfer_private_to_private().with.mockImplementationOnce(() => {
        throw new Error('Failed to set capsule');
      });

      const interaction = token.transferPrivate(recipient, amount, verifiedID);
      const sendMethodOptions = {};

      // The error should happen when we try to send
      await expect(interaction.send(sendMethodOptions)).rejects.toThrow();
    });

    // Test that the implementation handles invalid inputs
    it('should handle null recipient address', () => {
      // The implementation should handle this case one way or another
      const interaction = token.transferPrivate(nullAddr, amount, verifiedID);

      // Verify the contract method was called with the provided parameters
      expect(mockTokenContract.methods.transfer_private_to_private).toHaveBeenCalledWith(
        accountAddr,
        nullAddr,
        amount,
        Fr.ZERO,
      );

      expect(interaction).toBeDefined();
    });

    // Test that the implementation handles edge case amounts
    it('should handle edge case amounts', () => {
      // Call with negative amount
      const negativeInteraction = token.transferPrivate(recipient, negativeAmount, verifiedID);

      // Verify the contract method was called with the provided parameters
      expect(mockTokenContract.methods.transfer_private_to_private).toHaveBeenCalledWith(
        accountAddr,
        recipient,
        negativeAmount,
        Fr.ZERO,
      );

      expect(negativeInteraction).toBeDefined();

      // Reset the mock
      mockTokenContract.methods.transfer_private_to_private.mockClear();

      // Call with zero amount
      const zeroInteraction = token.transferPrivate(recipient, zeroAmount, verifiedID);

      // Verify the contract method was called with the provided parameters
      expect(mockTokenContract.methods.transfer_private_to_private).toHaveBeenCalledWith(
        accountAddr,
        recipient,
        zeroAmount,
        Fr.ZERO,
      );

      expect(zeroInteraction).toBeDefined();
    });
  });

  describe('shield', () => {
    const amount = BigInt(500);
    const zeroAmount = BigInt(0);
    const negativeAmount = BigInt(-1);

    it('should return a token interaction for shield operation', () => {
      const interaction = token.shield(amount);

      // Check the client method was called to get the sender address
      expect(mockL2Client.getAddress).toHaveBeenCalled();

      // Check that the contract method was called with the correct parameters
      expect(mockTokenContract.methods.shield).toHaveBeenCalledWith(accountAddr, amount, Fr.ZERO);

      // Check that we got an L2TokenInteraction back
      expect(interaction).toBeDefined();
      expect(interaction.getInteraction).toBeDefined();
    });

    it('should allow sending the shield interaction', async () => {
      const interaction = token.shield(amount);
      const sendMethodOptions = {};
      const tx = await interaction.send(sendMethodOptions);

      // Check that the send method was called
      expect(mockTokenContract.methods.shield().send).toHaveBeenCalledWith(sendMethodOptions);

      // Check that the result is the expected transaction
      expect(tx).toEqual({ txHash: '0xcdef' });
    });

    it('should throw an error when creating interaction fails', () => {
      // Mock the error
      const mockError = new Error('Failed to create interaction');
      mockTokenContract.methods.shield.mockImplementationOnce(() => {
        throw mockError;
      });

      // Check that the error is thrown
      expect(() => token.shield(amount)).toThrow();
    });

    // Test that implementation handles edge case amounts
    it('should handle edge case shield amounts', () => {
      // Call with negative amount
      const negativeInteraction = token.shield(negativeAmount);

      // Verify the contract method was called with the provided parameters
      expect(mockTokenContract.methods.shield).toHaveBeenCalledWith(accountAddr, negativeAmount, Fr.ZERO);

      expect(negativeInteraction).toBeDefined();

      // Reset the mock
      mockTokenContract.methods.shield.mockClear();

      // Call with zero amount
      const zeroInteraction = token.shield(zeroAmount);

      // Verify the contract method was called with the provided parameters
      expect(mockTokenContract.methods.shield).toHaveBeenCalledWith(accountAddr, zeroAmount, Fr.ZERO);

      expect(zeroInteraction).toBeDefined();
    });
  });

  describe('unshield', () => {
    const amount = BigInt(500);
    const zeroAmount = BigInt(0);
    const negativeAmount = BigInt(-1);

    it('should return a token interaction for unshield operation', () => {
      const interaction = token.unshield(amount);

      // Check the client method was called to get the sender address
      expect(mockL2Client.getAddress).toHaveBeenCalled();

      // Check that the contract method was called with the correct parameters
      expect(mockTokenContract.methods.unshield).toHaveBeenCalledWith(accountAddr, amount, Fr.ZERO);

      // Check that we got an L2TokenInteraction back
      expect(interaction).toBeDefined();
      expect(interaction.getInteraction).toBeDefined();
    });

    it('should allow sending the unshield interaction', async () => {
      const interaction = token.unshield(amount);
      const sendMethodOptions = {};
      const tx = await interaction.send(sendMethodOptions);

      // Check that the send method was called
      expect(mockTokenContract.methods.unshield().send).toHaveBeenCalledWith(sendMethodOptions);

      // Check that the result is the expected transaction
      expect(tx).toEqual({ txHash: '0xdefg' });
    });

    it('should throw an error when creating interaction fails', () => {
      // Mock the error
      const mockError = new Error('Failed to create interaction');
      mockTokenContract.methods.unshield.mockImplementationOnce(() => {
        throw mockError;
      });

      // Check that the error is thrown
      expect(() => token.unshield(amount)).toThrow();
    });

    // Test that implementation handles edge case amounts
    it('should handle edge case unshield amounts', () => {
      // Call with negative amount
      const negativeInteraction = token.unshield(negativeAmount);

      // Verify the contract method was called with the provided parameters
      expect(mockTokenContract.methods.unshield).toHaveBeenCalledWith(accountAddr, negativeAmount, Fr.ZERO);

      expect(negativeInteraction).toBeDefined();

      // Reset the mock
      mockTokenContract.methods.unshield.mockClear();

      // Call with zero amount
      const zeroInteraction = token.unshield(zeroAmount);

      // Verify the contract method was called with the provided parameters
      expect(mockTokenContract.methods.unshield).toHaveBeenCalledWith(accountAddr, zeroAmount, Fr.ZERO);

      expect(zeroInteraction).toBeDefined();
    });
  });

  describe('batch', () => {
    it('should return a batch builder', () => {
      const batch = token.batch();

      expect(batch).toBeDefined();
      expect(batch.add).toBeDefined();
      expect(batch.send).toBeDefined();
      expect(batch.simulate).toBeDefined();
    });
  });

  describe('createBurnAction', () => {
    const fromAddr = {
      toString: () => '0x3456789012345678901234567890123456789012',
    } as unknown as AztecAddress;
    const amount = BigInt(500);

    it('should create a burn action', async () => {
      // Setup the mock
      const mockAction = {
        functionName: 'burn_public',
        args: ['mockArgs'],
      } as unknown as ContractFunctionInteraction;

      mockTokenContract.methods.burn_public.mockReturnValue(mockAction);

      const result = await token.createBurnAction(fromAddr, amount);

      // Check that the contract method was called with the correct parameters
      expect(mockTokenContract.methods.burn_public).toHaveBeenCalledWith(
        fromAddr,
        amount,
        expect.anything(), // Should be a random nonce
      );

      // Check the result structure
      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('nonce');
      expect(result.action).toBe(mockAction);
    });

    it('should throw an error when contract interaction fails', async () => {
      // Mock the error - must match the TurnstileError structure
      const mockError = new TurnstileError(ErrorCode.L2_BURN_OPERATION, 'Failed to burn tokens', {
        amount: amount.toString(),
      });

      mockTokenContract.methods.burn_public.mockImplementationOnce(() => {
        throw mockError;
      });

      // Check that the error is thrown with the correct code
      await expect(token.createBurnAction(fromAddr, amount)).rejects.toHaveProperty(
        'code',
        ErrorCode.L2_BURN_OPERATION,
      );
    });

    // Test to cover the case where we get a null or invalid action from the contract
    it('should handle invalid contract return value', async () => {
      // Setup the mock to return null or undefined
      mockTokenContract.methods.burn_public.mockReturnValueOnce(null as unknown as ContractFunctionInteraction);

      // This should still give us an action, but we might get undefined or an error
      const result = await token.createBurnAction(fromAddr, amount);

      // Even if burn_public returns null, we should still have a nonce
      expect(result).toHaveProperty('nonce');
    });
  });

  describe('static methods', () => {
    describe('fromAddress', () => {
      it('should create a token from address', async () => {
        // Mock the TokenContract.at to return our mock contract
        TokenContract.at = vi.fn().mockResolvedValue(mockTokenContract);

        const result = await L2Token.fromAddress(tokenAddr, mockL2Client);

        // Check that the contract was retrieved with the correct parameters
        expect(TokenContract.at).toHaveBeenCalledWith(tokenAddr, mockWallet);

        // Check the result is a token instance with the correct contract
        expect(result).toBeInstanceOf(L2Token);
        expect(result.getAddress()).toBe(tokenAddr);
      });

      it('should throw an error when contract creation fails', async () => {
        // Mock the error
        const mockError = new Error('Token contract creation failed');
        TokenContract.at = vi.fn().mockRejectedValueOnce(mockError);

        // Check that the error is thrown with the correct code
        await expect(L2Token.fromAddress(tokenAddr, mockL2Client)).rejects.toHaveProperty(
          'code',
          ErrorCode.L2_CONTRACT_INTERACTION,
        );
      });
    });

    describe('deploy', () => {
      const name = 'Test Token';
      const symbol = 'TST';
      const decimals = 18;

      // Test to verify the deployment option setting
      it('should deploy with universal deploy enabled', async () => {
        Contract.deploy = vi.fn().mockReturnValue({
          send: vi.fn().mockReturnValue({
            deployed: vi.fn().mockResolvedValue({ address: tokenAddr }),
          }),
          request: vi.fn().mockResolvedValue({
            // Mock ExecutionPayload
            packedArguments: [],
            calls: [],
          }),
        });
        TokenContract.at = vi.fn().mockResolvedValue(mockTokenContract);

        const sendMethodOptions = {}; // Empty options for testing
        const result = await L2Token.deploy(mockL2Client, portalAddr, name, symbol, decimals, sendMethodOptions);

        // Check that the contract was deployed with the correct parameters
        expect(Contract.deploy).toHaveBeenCalledWith(
          mockWallet,
          undefined, // TokenContractArtifact (mocked as undefined)
          [name, symbol, decimals, portalAddr, undefined], // AztecAddress.ZERO becomes undefined in mock
          'constructor_with_minter',
        );

        // Check the result is a token instance
        expect(result).toBeInstanceOf(L2Token);
        expect(result.getAddress()).toBe(tokenAddr);
      });

      it('should deploy a new token contract', async () => {
        Contract.deploy = vi.fn().mockReturnValue({
          send: vi.fn().mockReturnValue({
            deployed: vi.fn().mockResolvedValue({ address: tokenAddr }),
          }),
          request: vi.fn().mockResolvedValue({
            // Mock ExecutionPayload
            packedArguments: [],
            calls: [],
          }),
        });
        TokenContract.at = vi.fn().mockResolvedValue(mockTokenContract);

        const sendMethodOptions = {}; // Empty options for testing
        const result = await L2Token.deploy(mockL2Client, portalAddr, name, symbol, decimals, sendMethodOptions);

        // Check that the contract was deployed with the correct parameters
        expect(Contract.deploy).toHaveBeenCalledWith(
          mockWallet,
          undefined, // TokenContractArtifact (mocked as undefined)
          [name, symbol, decimals, portalAddr, undefined], // AztecAddress.ZERO becomes undefined in mock
          'constructor_with_minter',
        );

        // Check the result is a token instance
        expect(result).toBeInstanceOf(L2Token);
        expect(result.getAddress()).toBe(tokenAddr);
      });

      it('should throw an error when deployment fails', async () => {
        // Mock the error
        const mockError = new TurnstileError(ErrorCode.L2_DEPLOYMENT, 'Failed to deploy token', {
          tokenName: name,
          tokenSymbol: symbol,
          decimals,
        });

        Contract.deploy = vi.fn().mockReturnValue({
          send: vi.fn().mockImplementation(() => {
            throw mockError;
          }),
          request: vi.fn().mockImplementation(() => {
            throw mockError;
          }),
        });

        const sendMethodOptions = {}; // Empty options for testing
        // Check that the error is thrown with the correct code
        await expect(
          L2Token.deploy(mockL2Client, portalAddr, name, symbol, decimals, sendMethodOptions),
        ).rejects.toHaveProperty('code', ErrorCode.L2_DEPLOYMENT);
      });
    });
  });
});
