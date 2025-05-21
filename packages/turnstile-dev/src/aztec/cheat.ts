import type { AztecNode } from '@aztec/aztec.js';
import { retryUntil } from '@aztec/aztec.js';

// For testing purposes, we can cheat by advancing the block number to what we want
export async function advanceBlocksUntil(node: AztecNode, endBlock: number) {
  console.log(`Advancing blocks to ${endBlock}`);

  const initialBlockNumber = await node.getBlockNumber();
  await retryUntil(async () => (await node.getBlockNumber()) >= initialBlockNumber + 1);

  console.log(`Current block is now ${await node.getBlockNumber()}`);
}
