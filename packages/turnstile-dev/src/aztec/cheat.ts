import { retryUntil } from '@aztec/aztec.js';
import { CounterContract } from '@aztec/noir-test-contracts.js/Counter';
import type { L2Client } from '@turnstile-portal/turnstile.js';

// Counter contract singleton
let counterContract: CounterContract | undefined;

export async function getCounterContract(l2Client: L2Client): Promise<CounterContract> {
  if (!counterContract) {
    console.log('Deploying Counter contract...');

    const wallet = l2Client.getWallet();
    const ownerAddress = wallet.getAddress();
    counterContract = await CounterContract.deploy(wallet, 0, ownerAddress).send().deployed();

    console.log(`Counter contract deployed at address: ${counterContract.address.toString()}`);
  }

  return counterContract;
}

export async function advanceBlocks(l2Client: L2Client, numBlocks = 1) {
  const node = l2Client.getNode();

  if (numBlocks <= 0) {
    console.warn(`advanceBlocks: Invalid number of blocks to advance: ${numBlocks}. Doing nothing.`);
    return;
  }

  const startBlock = await node.getBlockNumber();
  const endBlock = startBlock + numBlocks;
  console.log(`Current block: ${startBlock}, advancing ${numBlocks} blocks to ${endBlock}`);

  const chain = await node.getChainId();
  // We will cheat in the sandbox environment to advance blocks
  if (chain !== 31337) {
    throw new Error('advanceBlocks: This function is only supported in the sandbox environment (chain ID 31337).');
  }

  const counter = await getCounterContract(l2Client);
  // If the counter contract was not previously deployed, then it will be deployed
  // now and might have advaned the blocks already.
  const afterCounterBlockNumber = await node.getBlockNumber();
  const numBlocksStillNeeded = endBlock - afterCounterBlockNumber;

  const owner = l2Client.getWallet().getAddress();
  await retryUntil(async () => {
    for (let i = 0; i < numBlocksStillNeeded; i++) {
      await counter.methods.increment(owner, owner).send().wait();
    }
    const currentBlockNumber = await node.getBlockNumber();
    return currentBlockNumber >= endBlock;
  });

  const currentBlock = await node.getBlockNumber();
  console.log(`Current block is now ${currentBlock}. Advanced ${currentBlock - startBlock} blocks.`);
}

export async function waitForL2Block(l2Client: L2Client, endBlock: number) {
  const node = l2Client.getNode();
  const chainId = await node.getChainId();
  const startBlock = await node.getBlockNumber();

  if (endBlock <= startBlock) {
    console.log(`No need to wait, current block ${startBlock} is already at or beyond target block ${endBlock}.`);
    return;
  }

  console.log(`Advancing from ${startBlock} to ${endBlock}`);

  await retryUntil(async () => {
    if (chainId === 31337) {
      // In the sandbox environment, we can cheat by incrementing the block number directly
      await advanceBlocks(l2Client, endBlock - startBlock);
    } else {
      console.log(`waitForL2Block: waiting for blocks to advance naturally on Aztec chain ID ${chainId}...`);
    }
    const currentBlockNumber = await node.getBlockNumber();
    console.log(`Current block: ${currentBlockNumber}, target: ${endBlock}`);
    return currentBlockNumber >= endBlock;
  });

  const currentBlock = await node.getBlockNumber();
  if (currentBlock < endBlock) {
    // Print an error but don't throw an error....maybe useful things can still happen
    console.error(`waitForL2Block: Failed to reach target block ${endBlock}. Current block is ${currentBlock}.`);
  }
}
