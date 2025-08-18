import type {
  Address,
  TransactionReceipt,
  TransactionRequest,
} from 'viem';
import { ErrorCode, createError } from '../errors.js';
import { validateWallet, validatePositiveAmount } from '../validator.js';
import { IL1Client } from './client.js';
import { TOKEN_ABIS } from './abi.js';

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
   */
  getSymbol(): Promise<string>;

  /**
   * Gets the token name
   * @returns The token name
   */
  getName(): Promise<string>;

  /**
   * Gets the token decimals
   * @returns The token decimals
   */
  getDecimals(): Promise<number>;

  /**
   * Gets the token balance of an address
   * @param address The address to check
   * @returns The token balance
   */
  balanceOf(address: Address): Promise<bigint>;

  /**
   * Gets the token allowance of an owner for a spender
   * @param owner The owner address
   * @param spender The spender address
   * @returns The token allowance
   */
  allowance(owner: Address, spender: Address): Promise<bigint>;

  /**
   * Approves a spender to spend tokens
   * @param spender The spender address
   * @param amount The amount to approve
   * @returns The transaction receipt
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
   */
  async getSymbol(): Promise<string> {
    try {
      return await this.client.getPublicClient().readContract({
        address: this.address,
        abi: TOKEN_ABIS.symbol,
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
   */
  async getName(): Promise<string> {
    try {
      return await this.client.getPublicClient().readContract({
        address: this.address,
        abi: TOKEN_ABIS.name,
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
   */
  async getDecimals(): Promise<number> {
    try {
      return Number(await this.client.getPublicClient().readContract({
        address: this.address,
        abi: TOKEN_ABIS.decimals,
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
   */
  async balanceOf(address: Address): Promise<bigint> {
    try {
      return await this.client.getPublicClient().readContract({
        address: this.address,
        abi: TOKEN_ABIS.balanceOf,
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
   */
  async allowance(owner: Address, spender: Address): Promise<bigint> {
    try {
      return await this.client.getPublicClient().readContract({
        address: this.address,
        abi: TOKEN_ABIS.allowance,
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
   */
  async approve(
    spender: Address,
    amount: bigint
  ): Promise<TransactionReceipt> {
    try {
      const walletClient = this.client.getWalletClient();
      validateWallet(walletClient, 'Cannot approve: No account connected to wallet');
      validatePositiveAmount(amount, `Cannot approve amount ${amount}: amount must be positive`);

      // Use the ABI for the approve function from constants
      const abi = TOKEN_ABIS.approve;

      // Execute the transaction
      const hash = await walletClient.writeContract({
        address: this.address,
        abi,
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
   */
  async transfer(
    to: Address,
    amount: bigint
  ): Promise<TransactionReceipt> {
    try {
      const walletClient = this.client.getWalletClient();
      validateWallet(walletClient, 'Cannot transfer: No account connected to wallet');
      validatePositiveAmount(amount, `Cannot transfer amount ${amount}: amount must be positive`);

      // Use the ABI for the transfer function from constants
      const abi = TOKEN_ABIS.transfer;

      // Execute the transaction
      const hash = await walletClient.writeContract({
        address: this.address,
        abi,
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
