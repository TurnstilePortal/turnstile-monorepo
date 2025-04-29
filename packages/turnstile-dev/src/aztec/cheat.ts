import type { Wallet, PXE } from '@aztec/aztec.js';
import {
  createPXEClient,
  waitForPXE,
  FeeJuicePaymentMethod,
} from '@aztec/aztec.js';
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import { TestContract } from '@aztec/noir-contracts.js/Test';

// For testing purposes, we can cheat by advancing the block number to what we want
export async function advanceBlocksUntil(pxe: PXE, endBlock: number) {
  console.log(`Advancing blocks to ${endBlock}`);

  const [wallet] = await getInitialTestAccountsWallets(pxe);
  if (!wallet) {
    throw Error();
  }

  const test = await TestContract.deploy(wallet)
    .send({
      fee: {
        paymentMethod: new FeeJuicePaymentMethod(wallet.getAddress()),
        estimateGas: true,
      },
    })
    .deployed();

  while ((await pxe.getBlockNumber()) < endBlock) {
    await test.methods.get_this_address().send().wait();
  }
  console.log(`Current block is now ${await pxe.getBlockNumber()}`);
}
