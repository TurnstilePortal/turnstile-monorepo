import {
  FeeJuicePaymentMethod,
  type AztecAddress,
  type AztecNode,
  type Wallet,
} from '@aztec/aztec.js';
import type { UserFeeOptions } from '@aztec/entrypoints/interfaces';

/**
 * Interface for L2 client operations
 */
export interface IL2Client {
  getNode(): AztecNode;

  /**
   * Gets the wallet
   * @returns The wallet
   */
  getWallet(): Wallet;

  /**
   * Gets the account address
   * @returns The account address
   */
  getAddress(): AztecAddress;

  /**
   * Gets the fee options
   * @returns The fee options
   */
  getFeeOpts(): UserFeeOptions;
}

/**
 * Implementation of IL2Client using Aztec.js
 */
export class L2Client implements IL2Client {
  private node: AztecNode;
  private wallet: Wallet;

  /**
   * Creates a new L2Client
   * @param node The AztecNode client
   * @param wallet The wallet
   */
  constructor(node: AztecNode, wallet: Wallet) {
    this.node = node;
    this.wallet = wallet;
  }

  /**
   * Gets the AztecNode client
   * @returns The AztecNode client
   */
  getNode(): AztecNode {
    return this.node;
  }

  /**
   * Gets the wallet
   * @returns The wallet
   */
  getWallet(): Wallet {
    return this.wallet;
  }

  /**
   * Gets the account address
   * @returns The account address
   */
  getAddress(): AztecAddress {
    return this.wallet.getAddress();
  }

  /**
   * Gets the fee options
   * @returns The fee options
   */
  getFeeOpts(): UserFeeOptions {
    // TODO: make this configurable
    return {
      paymentMethod: new FeeJuicePaymentMethod(this.wallet.getAddress()),
      estimateGas: true,
    };
  }
}
