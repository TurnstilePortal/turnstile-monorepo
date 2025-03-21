import type { AztecAddress, PXE, Wallet } from '@aztec/aztec.js';

/**
 * Interface for L2 client operations
 */
export interface IL2Client {
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
 * Implementation of IL2Client using Aztec.js
 */
export class L2Client implements IL2Client {
  private pxe: PXE;
  private wallet: Wallet;

  /**
   * Creates a new L2Client
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
