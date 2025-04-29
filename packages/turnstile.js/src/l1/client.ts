import type {
  Account,
  Address,
  Chain,
  Client,
  PublicClient,
  Transport,
  WalletClient,
} from 'viem';
import { ErrorCode, createL1Error } from '../errors.js';
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
  private publicClient: PublicClient;
  private walletClient: WalletClient<Transport, Chain, Account>;

  /**
   * Creates a new L1Client
   * @param publicClient The public client
   * @param walletClient The wallet client
   */
  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient<Transport, Chain, Account>
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
  }

  /**
   * Gets the public client for read operations
   * @returns The public client
   */
  getPublicClient(): PublicClient {
    return this.publicClient;
  }

  /**
   * Gets the wallet client for write operations
   * @returns The wallet client
   */
  getWalletClient(): WalletClient {
    return this.walletClient;
  }

  /**
   * Gets the chain ID
   * @returns The chain ID
   */
  async getChainId(): Promise<number> {
    return this.publicClient.getChainId();
  }

  /**
   * Gets the account address
   * @returns The account address
   */
  getAddress(): Address {
    validateWallet(this.walletClient, 'Cannot get address: No account connected to wallet client');

    // Since validateWallet checks that account exists, we can safely use non-null assertion
    return this.walletClient.account!.address;
  }
}
