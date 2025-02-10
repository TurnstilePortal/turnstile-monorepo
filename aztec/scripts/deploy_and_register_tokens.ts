import {
  type AccountWalletWithSecretKey,
  type PXE,
  createPXEClient,
  TxStatus,
} from '@aztec/aztec.js';
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'node:fs';

import { createPublicClient, http } from 'viem';
import { anvil } from 'viem/chains';

import {
  AztecToken,
  AztecTokenContract,
  AztecTokenPortal,
  L1TokenPortal,
  getERC20Contract,
} from '@turnstile-portal/turnstile.js';

const { RPC_URL = 'http://localhost:8545', PXE_URL = 'http://localhost:8080' } =
  process.env;

const pxe = createPXEClient(PXE_URL);
const [wallet] = await getInitialTestAccountsWallets(pxe);
const publicClient = createPublicClient({
  chain: anvil,
  transport: http(RPC_URL),
});

const argv = await yargs(hideBin(process.argv))
  .option('deploymentData', {
    alias: 'dd',
    type: 'string',
    description: 'Deployment Data',
    demandOption: true,
    default: 'sandbox_deployment.json',
  })
  .option('l1RegisterTransactionHashes', {
    alias: 'txs',
    type: 'array',
    description: 'L1TokenPortal.register() transaction hash',
    demandOption: true,
  })
  .string('l1RegisterTransactionHashes').argv;

async function main() {
  const deploymentData = JSON.parse(
    fs.readFileSync(argv.deploymentData, 'utf8'),
  );

  // if tokens object is not present in deployment data, create it
  if (!deploymentData.tokens) {
    deploymentData.tokens = {};
  }

  const aztecPortal = new AztecTokenPortal(
    deploymentData.aztecPortal,
    pxe,
    wallet,
  );

  console.log(
    `Registering tokens from transaction hashes: ${argv.l1RegisterTransactionHashes}`,
  );

  for (const l1tx of argv.l1RegisterTransactionHashes) {
    const l1Receipt = await publicClient.getTransactionReceipt({
      hash: l1tx as `0x${string}`,
    });
    const registerLog = L1TokenPortal.parseRegisterLog(l1Receipt);
    const messageSentLog = L1TokenPortal.parseMessageSentLog(l1Receipt);

    const l1TokenAddr = registerLog.token;
    const l1Token = await getERC20Contract(l1TokenAddr, publicClient);
    const name = await l1Token.read.name();
    const symbol = await l1Token.read.symbol();
    const decimals = await l1Token.read.decimals();

    console.log(`Deploying Aztec token ${name} (${symbol}) for ${l1TokenAddr}`);

    const aztecToken = await AztecToken.deploy(
      wallet,
      aztecPortal.portalAddr,
      name,
      symbol,
      decimals,
    );

    // Wait for the L1ToL2Message to make it to the L2 chain
    await advanceBlocksUntil(pxe, wallet, Number(messageSentLog.l2BlockNumber));

    console.log(
      `Registering token ${name} (${symbol}) with ${l1TokenAddr} on Aztec Portal ${aztecPortal.portalAddr}`,
    );
    const tx = await aztecPortal.registerToken(
      l1TokenAddr,
      aztecToken.address(),
      name,
      symbol,
      decimals,
      messageSentLog.hash,
    );

    const l2Receipt = await tx.wait();

    console.log(`L2 Receipt status: ${l2Receipt.status}`);

    deploymentData.tokens[l1TokenAddr] = {
      name,
      symbol,
      decimals,
      l2Address: aztecToken.address().toString(),
      l1Address: l1TokenAddr,
    };
  }

  fs.writeFileSync(
    argv.deploymentData,
    JSON.stringify(deploymentData, null, 2),
  );
  console.log(`Deployment data written to ${argv.deploymentData}`);
}

// For testing purposes, we can cheat by advancing the block number to what we want
export async function advanceBlocksUntil(
  pxe: PXE,
  wallet: AccountWalletWithSecretKey,
  endBlock: number,
) {
  const currentBlock = await pxe.getBlockNumber();
  if (currentBlock >= endBlock) {
    console.log(
      `Current block number ${currentBlock} is already at or after end block ${endBlock}`,
    );
    return;
  }

  console.log(`Advancing blocks from ${currentBlock} to ${endBlock}`);

  // To advance blocks, we put in some dummy transactions
  const token = await AztecTokenContract.deploy(
    wallet,
    wallet.getAddress(),
    'dummy',
    'd',
    18,
  )
    .send()
    .deployed();

  let tx = await token.methods
    .mint_public(wallet.getAddress(), 1000000000000000n)
    .send();
  let receipt = await tx.wait();
  if (receipt.status !== TxStatus.SUCCESS) {
    throw new Error(`advanceBlocksUnit(${endBlock}) mint() failed: ${receipt}`);
  }

  while ((await pxe.getBlockNumber()) < endBlock) {
    tx = await token.methods
      .transfer_public(wallet.getAddress(), wallet.getAddress(), 1n, 0n)
      .send();
    receipt = await tx.wait();
    if (receipt.status !== TxStatus.SUCCESS) {
      throw new Error(
        `advanceBlocksUnit(${endBlock}) transfer_public() failed: ${receipt}`,
      );
    }
  }
  console.log(`Current block is now ${await pxe.getBlockNumber()}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
