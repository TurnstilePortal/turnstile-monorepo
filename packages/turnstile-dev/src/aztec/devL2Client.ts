import type { AztecNode, PXE, Wallet } from '@aztec/aztec.js';
import { L2Client } from '@turnstile-portal/turnstile.js';

export class DevL2Client extends L2Client {
  private pxe: PXE;

  constructor(node: AztecNode, wallet: Wallet, pxe: PXE) {
    super(node, wallet);
    this.pxe = pxe;
  }

  getPXE(): PXE {
    return this.pxe;
  }
}
