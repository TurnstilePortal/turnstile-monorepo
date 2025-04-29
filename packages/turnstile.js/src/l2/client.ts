import {
  FeeJuicePaymentMethod,
  type AztecAddress,
  type AztecNode,
  type PXE,
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
   * Gets the PXE client
   * @returns The PXE client
   */
  getPxe(): PXE;

  /**
   * Gets the account address
   * @returns The account address
   */
  getAddress(): AztecAddress;
}

/**
 * Implementation of IL2Client using Aztec.js
 */
export class L2Client implements IL2Client {
  private node: AztecNode;
  private pxe: PXE;
  private wallet: Wallet;

  /**
   * Creates a new L2Client
   * @param node The AztecNode client
   * @param wallet The wallet
   */
  constructor(node: AztecNode, pxe: PXE, wallet: Wallet) {
    this.node = node;
    this.pxe = pxe;
    this.wallet = wallet;
  }

  /**
   * Gets the AztecNode client
   * @returns The AztecNode client
   */
  getNode(): AztecNode {
    return this.node;
  }

  getPxe(): PXE {
    return this.pxe;
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

  getFeeOpts(): UserFeeOptions {
    // TODO: make this configurable
    return {
      paymentMethod: new FeeJuicePaymentMethod(this.wallet.getAddress()),
      estimateGas: true,
    };
  }
}
