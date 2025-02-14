import {
  AztecAddress,
  Fr,
  ExtendedNote,
  Note,
  TxStatus,
  sleep,
} from '@aztec/aztec.js';
import type { Wallet, TxHash, AccountWallet, PXE } from '@aztec/aztec.js';
import { TokenContract } from '@turnstile-portal/aztec-artifacts';
import { DevAdvanceBlockContract } from '@turnstile-portal/aztec-artifacts';

// For testing purposes, we can cheat by advancing the block number to what we want
export async function advanceBlocksUntil(
  pxe: PXE,
  wallet: Wallet,
  devAdvanceBlockAddress: `0x${string}`,
  endBlock: number,
) {
  console.log(`Advancing blocks to ${endBlock}`);

  // To advance blocks, we put in some dummy transactions
  const devAdvanceBlock = await DevAdvanceBlockContract.at(
    AztecAddress.fromString(devAdvanceBlockAddress),
    wallet,
  );
  while ((await pxe.getBlockNumber()) < endBlock) {
    await sleep(100000);
    const tx = await devAdvanceBlock.methods.increment().send();
    const receipt = await tx.wait();
    if (receipt.status !== TxStatus.SUCCESS) {
      throw new Error(
        `advanceBlocksUnit(${endBlock}) transfer_public() failed: ${receipt}`,
      );
    }
  }
  console.log(`Current block is now ${await pxe.getBlockNumber()}`);
}
