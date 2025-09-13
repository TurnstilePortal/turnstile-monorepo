import type {
  Address,
  TransactionReceipt,
} from 'viem';
import { erc20Abi } from 'viem';
import { ErrorCode, createError } from '../errors.js';
import { validateWallet, validatePositiveAmount } from '../validator.js';
import { IL1Client } from './client.js';

/**
 * Interface for L1 token operations
 */
export interface IL1Token {
  /**
   * Gets the token address
   * @returns The token address
   */
  getAddress(): Address;

  /**
   * Gets the token symbol
   * @returns The token symbol
   * @throws {TurnstileError} With ErrorCode.L1_TOKEN_OPERATION if the contract call fails
   */
  getSymbol(): Promise<string>;

  /**
   * Gets the token name
   * @returns The token name
   * @throws {TurnstileError} With ErrorCode.L1_TOKEN_OPERATION if the contract call fails
   */
  getName(): Promise<string>;

  /**
   * Gets the token decimals
   * @returns The token decimals
   * @throws {TurnstileError} With ErrorCode.L1_TOKEN_OPERATION if the contract call fails
   */
  getDecimals(): Promise<number>;

  /**
   * Gets the token balance of an address
   * @param address The address to check
   * @returns The token balance
   * @throws {TurnstileError} With ErrorCode.L1_TOKEN_OPERATION if the contract call fails
   */
  balanceOf(address: Address): Promise<bigint>;

  /**
   * Gets the token allowance of an owner for a spender
   * @param owner The owner address
   * @param spender The spender address
   * @returns The token allowance
   * @throws {TurnstileError} With ErrorCode.L1_TOKEN_OPERATION if the contract call fails
   */
  allowance(owner: Address, spender: Address): Promise<bigint>;

  /**
   * Approves a spender to spend tokens
   * @param spender The spender address
   * @param amount The amount to approve
   * @returns The transaction receipt
   * @throws {TurnstileError} With ErrorCode.VALIDATION_ACCOUNT if wallet has no account
   * @throws {TurnstileError} With ErrorCode.VALIDATION_AMOUNT if amount is not positive
   * @throws {TurnstileError} With ErrorCode.L1_TOKEN_OPERATION if the transaction fails
   */
  approve(
    spender: Address,
    amount: bigint
  ): Promise<TransactionReceipt>;

  /**
   * Transfers tokens to a recipient
   * @param to The recipient address
   * @param amount The amount to transfer
   * @returns The transaction receipt
   * @throws {TurnstileError} With ErrorCode.VALIDATION_ACCOUNT if wallet has no account
   * @throws {TurnstileError} With ErrorCode.VALIDATION_AMOUNT if amount is not positive
   * @throws {TurnstileError} With ErrorCode.L1_TOKEN_OPERATION if the transaction fails
   */
  transfer(
    to: Address,
    amount: bigint
  ): Promise<TransactionReceipt>;
}

/**
 * Implementation of IL1Token for ERC20 tokens
 */
export class L1Token implements IL1Token {
  private address: Address;
  protected client: IL1Client;

  /**
   * Creates a new L1Token
   * @param address The token address
   * @param client The L1 client
   */
  constructor(address: Address, client: IL1Client) {
    this.address = address;
    this.client = client;
  }

  /**
   * Gets the token address
   * @returns The token address
   */
  getAddress(): Address {
    return this.address;
  }

  /**
   * Gets the token symbol
   * @returns The token symbol
   * @throws {TurnstileError} With ErrorCode.L1_TOKEN_OPERATION if the contract call fails
   */
  async getSymbol(): Promise<string> {
    try {
      return await this.client.getPublicClient().readContract({
        address: this.address,
        abi: erc20Abi,
        functionName: 'symbol',
      }) as string;
    } catch (error) {
      throw createError(
        ErrorCode.L1_TOKEN_OPERATION,
        `Failed to get symbol for token ${this.address}`,
        { tokenAddress: this.address },
        error
      );
    }
  }

  /**
   * Gets the token name
   * @returns The token name
   * @throws {TurnstileError} With ErrorCode.L1_TOKEN_OPERATION if the contract call fails
   */
  async getName(): Promise<string> {
    try {
      return await this.client.getPublicClient().readContract({
        address: this.address,
        abi: erc20Abi,
        functionName: 'name',
      }) as string;
    } catch (error) {
      throw createError(
        ErrorCode.L1_TOKEN_OPERATION,
        `Failed to get name for token ${this.address}`,
        { tokenAddress: this.address },
        error
      );
    }
  }

  /**
   * Gets the token decimals
   * @returns The token decimals
   * @throws {TurnstileError} With ErrorCode.L1_TOKEN_OPERATION if the contract call fails
   */
  async getDecimals(): Promise<number> {
    try {
      return Number(await this.client.getPublicClient().readContract({
        address: this.address,
        abi: erc20Abi,
        functionName: 'decimals',
      }));
    } catch (error) {
      throw createError(
        ErrorCode.L1_TOKEN_OPERATION,
        `Failed to get decimals for token ${this.address}`,
        { tokenAddress: this.address },
        error
      );
    }
  }

  /**
   * Gets the token balance of an address
   * @param address The address to check
   * @returns The token balance
   * @throws {TurnstileError} With ErrorCode.L1_TOKEN_OPERATION if the contract call fails
   */
  async balanceOf(address: Address): Promise<bigint> {
    try {
      return await this.client.getPublicClient().readContract({
        address: this.address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      }) as bigint;
    } catch (error) {
      throw createError(
        ErrorCode.L1_TOKEN_OPERATION,
        `Failed to get balance for token ${this.address} for address ${address}`,
        { tokenAddress: this.address, userAddress: address },
        error
      );
    }
  }

  /**
   * Gets the token allowance of an owner for a spender
   * @param owner The owner address
   * @param spender The spender address
   * @returns The token allowance
   * @throws {TurnstileError} With ErrorCode.L1_TOKEN_OPERATION if the contract call fails
   */
  async allowance(owner: Address, spender: Address): Promise<bigint> {
    try {
      return await this.client.getPublicClient().readContract({
        address: this.address,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [owner, spender],
      }) as bigint;
    } catch (error) {
      throw createError(
        ErrorCode.L1_TOKEN_OPERATION,
        `Failed to get allowance for token ${this.address} for owner ${owner} and spender ${spender}`,
        { tokenAddress: this.address, owner, spender },
        error
      );
    }
  }

  /**
   * Approves a spender to spend tokens
   * @param spender The spender address
   * @param amount The amount to approve
   * @param options Transaction options
   * @returns The transaction receipt
   * @throws {TurnstileError} With ErrorCode.VALIDATION_ACCOUNT if wallet has no account
   * @throws {TurnstileError} With ErrorCode.VALIDATION_AMOUNT if amount is not positive
   * @throws {TurnstileError} With ErrorCode.L1_TOKEN_OPERATION if the transaction fails
   */
  async approve(
    spender: Address,
    amount: bigint
  ): Promise<TransactionReceipt> {
    try {
      const walletClient = this.client.getWalletClient();
      validateWallet(walletClient, 'Cannot approve: No account connected to wallet');
      validatePositiveAmount(amount, `Cannot approve amount ${amount}: amount must be positive`);

      // Execute the transaction
      const hash = await walletClient.writeContract({
        address: this.address,
        abi: erc20Abi,
        functionName: 'approve',
        args: [spender, amount],
        account: walletClient.account!,
        chain: walletClient.chain || null,
      });

      return await this.client.getPublicClient().waitForTransactionReceipt({ hash });
    } catch (error) {
      throw createError(
        ErrorCode.L1_TOKEN_OPERATION,
        `Failed to approve ${amount} tokens for spender ${spender} for token ${this.address}`,
        { tokenAddress: this.address, amount: amount.toString(), spender },
        error
      );
    }
  }

  /**
   * Transfers tokens to a recipient
   * @param to The recipient address
   * @param amount The amount to transfer
   * @param options Transaction options
   * @returns The transaction receipt
   * @throws {TurnstileError} With ErrorCode.VALIDATION_ACCOUNT if wallet has no account
   * @throws {TurnstileError} With ErrorCode.VALIDATION_AMOUNT if amount is not positive
   * @throws {TurnstileError} With ErrorCode.L1_TOKEN_OPERATION if the transaction fails
   */
  async transfer(
    to: Address,
    amount: bigint
  ): Promise<TransactionReceipt> {
    try {
      const walletClient = this.client.getWalletClient();
      validateWallet(walletClient, 'Cannot transfer: No account connected to wallet');
      validatePositiveAmount(amount, `Cannot transfer amount ${amount}: amount must be positive`);

      // Execute the transaction
      const hash = await walletClient.writeContract({
        address: this.address,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [to, amount],
        account: walletClient.account!,
        chain: walletClient.chain || null,
      });

      return await this.client.getPublicClient().waitForTransactionReceipt({ hash });
    } catch (error) {
      throw createError(
        ErrorCode.L1_TOKEN_OPERATION,
        `Failed to transfer ${amount} tokens to ${to} for token ${this.address}`,
        { tokenAddress: this.address, amount: amount.toString(), recipient: to },
        error
      );
    }
  }
}
