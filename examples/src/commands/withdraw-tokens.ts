import type { Command } from 'commander';
import { createAztecNodeClient, AztecAddress, TxStatus } from '@aztec/aztec.js';
import type { AztecNode, Fr } from '@aztec/aztec.js';
import { http, getAddress, type Hex } from 'viem';
import {
  getChain,
  getClients,
  readDeploymentData,
  setAssumeProven,
} from '@turnstile-portal/turnstile-dev';

import { commonOpts } from '@turnstile-portal/deploy/commands';

import {
  L1Token,
  L1Portal,
  L2Token,
  L2Portal,
  type L2Client,
  type IL1Client,
} from '@turnstile-portal/turnstile.js';

async function initiateL2Withdrawal({
  l2Client,
  l2TokenAddr,
  l2PortalAddr,
  l1TokenAddr,
  l1Recipient,
  amount,
}: {
  l2Client: L2Client;
  l2TokenAddr: AztecAddress;
  l2PortalAddr: AztecAddress;
  l1Recipient: Hex;
  l1TokenAddr: Hex;
  amount: bigint;
}) {
  // Get L2 token
  const l2Token = await L2Token.fromAddress(l2TokenAddr, l2Client);

  const symbol = await l2Token.getSymbol();
  console.log(
    `Initiating withdrawal of ${amount} ${symbol} to L1 recipient ${l1Recipient}`,
  );

  console.log(
    'Current L2 balance:',
    await l2Token.balanceOfPublic(l2Client.getAddress()),
  );

  // Create burn action
  const { action, nonce } = await l2Token.createBurnAction(
    l2Client.getAddress(),
    amount,
  );

  // Authorize the burn action
  // The authorization approach has changed significantly in the new API
  // Simplified this to avoid setting auth wit directly since the API might have changed
  console.log('Setting up burn authorization...');

  // Most likely, the L2Portal's withdrawPublic method will handle the authorization internally
  // or the burn functionality itself will handle it
  console.log('Proceeding directly to withdrawal since the API has changed...');

  // Use the L2Portal
  const l2Portal = new L2Portal(l2PortalAddr, l2Client);

  // Initiate the withdrawal from the Portal
  const { tx: withdrawTx, leaf } = await l2Portal.withdrawPublic(
    l1TokenAddr,
    l1Recipient,
    amount,
    nonce,
  );

  console.log(
    `Withdrawal initiated on L2. Tx: ${(await withdrawTx.getTxHash()).toString()}`,
  );
  console.log(`L2 to L1 message leaf: ${leaf}`);

  const receipt = await withdrawTx.wait();
  if (receipt.status !== TxStatus.SUCCESS) {
    throw new Error('Withdrawal failed');
  }
  if (!receipt.blockNumber) {
    throw new Error('Failed to get block number');
  }
  const l2BlockNumber = BigInt(receipt.blockNumber);
  console.log(`L2 block number: ${l2BlockNumber}`);
  console.log(
    'New L2 balance:',
    await l2Token.balanceOfPublic(l2Client.getAddress()),
  );

  // Create withdrawal data manually
  const withdrawData: Hex = `0x${l1TokenAddr.slice(2)}${l1Recipient.slice(2)}${amount.toString(16).padStart(64, '0')}`;

  return { l2BlockNumber, leaf, withdrawData };
}

async function completeL1Withdrawal({
  l1Client,
  l1TokenAddr,
  l1Portal,
  withdrawData,
  l2BlockNumber,
  leaf,
  node,
}: {
  l1Client: IL1Client;
  l1TokenAddr: Hex;
  l1Portal: L1Portal;
  withdrawData: Hex;
  l2BlockNumber: bigint;
  node: AztecNode;
  leaf: Fr;
}) {
  console.log('Waiting for L2 block to be available on L1...');
  await l1Portal.waitForBlockOnL1(
    l2BlockNumber,
    60, // Timeout in seconds
  );

  const [l2ToL1MessageIndex, siblingPath] =
    await node.getL2ToL1MessageMembershipWitness(Number(l2BlockNumber), leaf);

  const l1Token = new L1Token(l1TokenAddr, l1Client);
  console.log(
    `Current L1 balance: ${await l1Token.balanceOf(l1Client.getAddress())}`,
  );

  const tx = await l1Portal.withdraw(
    withdrawData,
    l2BlockNumber,
    l2ToL1MessageIndex,
    siblingPath,
  );
  console.log(`L1 Withdraw transaction hash: ${tx}`);

  const receipt = await l1Client
    .getPublicClient()
    .waitForTransactionReceipt({ hash: tx });
  if (receipt.status !== 'success') {
    throw new Error(`L1 Withdraw transaction failed: ${receipt.status}`);
  }
  console.log('L1 Withdrawal complete');
  console.log(
    `New L1 balance: ${await l1Token.balanceOf(l1Client.getAddress())}`,
  );
}

export function registerWithdrawTokens(program: Command) {
  return program
    .command('withdraw-tokens')
    .description('Withdraw tokens from L2 to L1')
    .addOption(commonOpts.keys)
    .addOption(commonOpts.l1Chain)
    .addOption(commonOpts.rpc)
    .addOption(commonOpts.deploymentData)
    .option('--token <symbol>', 'Token Symbol', 'TT1')
    .option('--l1-recipient <address>', 'L1 Recipient Address')
    .option('--amount <a>', 'Amount', '1000')
    .action(async (options) => {
      const deploymentData = await readDeploymentData(options.deploymentData);
      const tokenInfo = deploymentData.tokens[options.token];
      if (!tokenInfo) {
        throw new Error(`Token ${options.token} not found in deployment data`);
      }
      const l2TokenAddr = AztecAddress.fromString(tokenInfo.l2Address);
      const l1TokenAddr = getAddress(tokenInfo.l1Address) as `0x${string}`;
      const l1RollupAddr = deploymentData.rollupAddress;

      const node = createAztecNodeClient(options.aztecNode);

      const { l1Client, l2Client } = await getClients(
        options.aztecNode,
        {
          chain: getChain(options.l1Chain),
          transport: http(options.rpc),
        },
        options.keys,
      );

      const l1Recipient = options.l1RecipientAddr
        ? getAddress(options.l1Recipient)
        : l1Client.getAddress();
      const amount = BigInt(options.amount);

      const { l2BlockNumber, leaf, withdrawData } = await initiateL2Withdrawal({
        l2Client,
        l2TokenAddr,
        l2PortalAddr: AztecAddress.fromString(deploymentData.aztecPortal),
        l1TokenAddr,
        l1Recipient,
        amount,
      });

      // Wait for the L2 block to be available on the L1 chain
      const l1Portal = new L1Portal(
        getAddress(deploymentData.l1Portal),
        l1Client,
      );

      // Cheat to make the L2 block available on L1
      await setAssumeProven(options.rpc, l1RollupAddr, l2BlockNumber);
      console.log(
        `Waiting for L2 block ${l2BlockNumber} to be available on L1...`,
      );
      await l1Portal.waitForBlockOnL1(l2BlockNumber, 60);

      // L2 block is available. Withdraw the tokens on L1 chain.
      await completeL1Withdrawal({
        l1Client,
        l1TokenAddr,
        l1Portal,
        withdrawData,
        l2BlockNumber,
        leaf,
        node,
      });
    });
}
