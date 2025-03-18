import type { Wallet, PXE } from '@aztec/aztec.js';
import { TestContract } from '@aztec/noir-contracts.js/Test';

// For testing purposes, we can cheat by advancing the block number to what we want
export async function advanceBlocksUntil(
  pxe: PXE,
  wallet: Wallet,
  endBlock: number,
) {
  console.log(`Advancing blocks to ${endBlock}`);

  const test = await TestContract.deploy(wallet)
    .send({ universalDeploy: true, skipClassRegistration: true })
    .deployed();

  while ((await pxe.getBlockNumber()) < endBlock) {
    await test.methods.get_this_address().send().wait();
  }
  console.log(`Current block is now ${await pxe.getBlockNumber()}`);
}
