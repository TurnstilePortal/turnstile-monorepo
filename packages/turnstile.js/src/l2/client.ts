import type { AztecAddress, PXE, Wallet } from '@aztec/aztec.js';
import { L2Error } from '../errors.js';

/**
 * Interface for L2 client operations
 */
export interface L2Client {
  /**
   * Gets the PXE client
   * @returns The PXE client
   */
  getPXE(): PXE;

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
}

/**
 * Implementation of L2Client using Aztec.js
 */
export class AztecL2Client implements L2Client {
  private pxe: PXE;
  private wallet: Wallet;

  /**
   * Creates a new AztecL2Client
   * @param pxe The PXE client
   * @param wallet The wallet
   */
  constructor(pxe: PXE, wallet: Wallet) {
    this.pxe = pxe;
    this.wallet = wallet;
  }

  /**
   * Gets the PXE client
   * @returns The PXE client
   */
  getPXE(): PXE {
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
}
