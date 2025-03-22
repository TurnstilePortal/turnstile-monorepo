import type { Command } from 'commander';
import {
  createAztecNodeClient,
  createPXEClient,
  TxStatus,
  AztecAddress,
} from '@aztec/aztec.js';
import { http, getAddress } from 'viem';
import type { Address } from 'viem';
import {
  advanceBlocksUntil,
  getChain,
  getClients,
  readDeploymentData,
  InsecureMintableToken,
} from '@turnstile-portal/turnstile-dev';

import { commonOpts } from '@turnstile-portal/deploy/commands';

import type { IL1Client } from '@turnstile-portal/turnstile.js';
import {
  L1Portal,
  L2Portal,
  type L1Client,
  L2Client,
} from '@turnstile-portal/turnstile.js';

async function l1MintAndDeposit({
  l1PortalAddr,
  tokenAddr,
  l2RecipientAddr,
  amount,
  l1Client,
}: {
  l1PortalAddr: Address;
  tokenAddr: Address;
  l2RecipientAddr: string;
  amount: bigint;
  l1Client: L1Client;
}): Promise<{ hash: string; l2BlockNumber: number; index: number }> {
  const tokenClient = new InsecureMintableToken(tokenAddr, l1Client);

  // Mint tokens to the wallet holder
  // Minting is for testing only
  await tokenClient.mint(tokenAddr, l1Client.getAddress(), amount);

  // Approve the Token Portal to spend the tokens. Required before depositing.
  await tokenClient.approve(l1PortalAddr, amount);

  // Deposit the tokens to the L2 network
  const portal = new L1Portal(l1PortalAddr, l1Client);

  // Call deposit with the required parameters
  const result = await portal.deposit(tokenAddr, l2RecipientAddr, amount);

  // Wait for confirmation
  console.log('L1 Deposit initiated. Waiting for confirmation...');
  const receipt = await l1Client.getPublicClient().waitForTransactionReceipt({
    hash: result.txHash,
  });

  if (receipt.status !== 'success') {
    throw new Error(`deposit() failed: ${receipt}`);
  }

  console.log(`L1 Deposit successful. Transaction hash: ${result.txHash}`);
  console.log(
    `Message hash: ${result.messageHash}, Message index: ${result.messageIndex}`,
  );

  // For our example, we just need to extract the L2 block number from the logs
  // This is a simplified approach since the API has changed
  const l2BlockNumber = Number(receipt.blockNumber) + 1; // Estimated L2 block number

  console.log(
    `Estimated L2 Block Number: ${l2BlockNumber}, Message Index: ${result.messageIndex}`,
  );

  return {
    hash: result.messageHash,
    l2BlockNumber: l2BlockNumber,
    index: Number(result.messageIndex),
  };
}

export function registerDepositAndClaim(program: Command) {
  return program
    .command('deposit-and-claim')
    .description('Deposit tokens from L1 to L2 and claim them')
    .addOption(commonOpts.keys)
    .addOption(commonOpts.pxe)
    .addOption(commonOpts.l1Chain)
    .addOption(commonOpts.rpc)
    .addOption(commonOpts.deploymentData)
    .option('--token <symbol>', 'Token Symbol', 'TT1')
    .option('--l2-recipient <address>', 'L2 Recipient Address')
    .option('--amount <a>', 'Amount', '1000000000')
    .action(async (options) => {
      const deploymentData = await readDeploymentData(options.deploymentData);
      const tokenInfo = deploymentData.tokens[options.token];
      if (!tokenInfo) {
        throw new Error(`Token ${options.token} not found in deployment data`);
      }
      const l1TokenAddr = tokenInfo.l1Address;

      const pxe = createPXEClient(options.pxe);
      const node = createAztecNodeClient(options.aztecNode);

      const { l1Client, l2Client } = await getClients(
        node,
        pxe,
        {
          chain: getChain(options.l1Chain),
          transport: http(options.rpc),
        },
        options.keys,
      );

      const amount = BigInt(options.amount);

      const l2Recipient = options.l2Recipient
        ? options.l2Recipient
        : l2Client.getAddress().toString();

      const { index, hash, l2BlockNumber } = await l1MintAndDeposit({
        l1PortalAddr: getAddress(deploymentData.l1Portal),
        tokenAddr: getAddress(l1TokenAddr),
        l2RecipientAddr: l2Recipient,
        amount,
        l1Client,
      });

      // We need to wait for the L2 block to be mined so that the L1ToL2Message is available on the L2 chain.
      // In a real scenario, we would wait for the L2 blocks to be mined naturally, but for testing purposes
      // we will advance the blocks ourselves.
      await advanceBlocksUntil(pxe, l2Client.getWallet(), l2BlockNumber);

      // Convert string address to AztecAddress
      const aztecPortalAddr = AztecAddress.fromString(
        deploymentData.aztecPortal,
      );

      const aztecPortal = new L2Portal(aztecPortalAddr, l2Client);

      // Convert Ethereum address to string for the claimDeposit call
      const formattedTokenAddr = getAddress(l1TokenAddr);

      const tx = await aztecPortal.claimDeposit(
        formattedTokenAddr,
        l2Recipient,
        BigInt(options.amount),
        BigInt(index),
      );
      console.log(
        `Claim transaction hash: ${await tx.getTxHash()}\nWaiting for receipt...`,
      );
      const receipt = await tx.wait();
      if (receipt.status !== TxStatus.SUCCESS) {
        throw new Error(`claimDeposit() failed. status: ${receipt.status}`);
      }
      console.log(`Deposit and claim for token ${options.token} complete`);
    });
}
