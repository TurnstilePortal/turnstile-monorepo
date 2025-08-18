import type {
  Account,
  Address,
  Chain,
  Client,
  PublicClient,
  Transport,
  WalletClient,
} from 'viem';
import { ErrorCode, createError } from '../errors.js';
import { validateWallet } from '../validator.js';

/**
 * Interface for L1 client operations
 */
export interface IL1Client {
  /**
   * Gets the public client for read operations
   * @returns The public client
   */
  getPublicClient(): PublicClient;

  /**
   * Gets the wallet client for write operations
   * @returns The wallet client
   */
  getWalletClient(): WalletClient;

  /**
   * Gets the chain ID
   * @returns The chain ID
   */
  getChainId(): Promise<number>;

  /**
   * Gets the account address
   * @returns The account address
   */
  getAddress(): Address;
}

/**
 * Implementation of IL1Client using Viem
 */
export class L1Client implements IL1Client {
  public readonly public: PublicClient;
  public readonly wallet: WalletClient<Transport, Chain, Account>;

  /**
   * Creates a new L1Client
   * @param publicClient The public client
   * @param walletClient The wallet client
   */
  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient<Transport, Chain, Account>
  ) {
    this.public = publicClient;
    this.wallet = walletClient;
  }

  /**
   * Gets the public client for read operations
   * @returns The public client
   */
  getPublicClient(): PublicClient {
    return this.public;
  }

  /**
   * Gets the wallet client for write operations
   * @returns The wallet client
   */
  getWalletClient(): WalletClient<Transport, Chain, Account> {
    return this.wallet;
  }

  /**
   * Gets the chain ID
   * @returns The chain ID
   */
  async getChainId(): Promise<number> {
    return this.public.getChainId();
  }

  /**
   * Gets the account address
   * @returns The account address
   */
  getAddress(): Address {
    validateWallet(this.wallet, 'Cannot get address: No account connected to wallet client');

    // Since validateWallet checks that account exists, we can safely use non-null assertion
    return this.wallet.account!.address;
  }
}
