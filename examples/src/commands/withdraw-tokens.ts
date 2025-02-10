import type { Command } from 'commander';
import {
  createPXEClient,
  createAztecNodeClient,
  AztecAddress,
  TxStatus,
} from '@aztec/aztec.js';
import type { AccountWallet, AztecNode, Fr, PXE } from '@aztec/aztec.js';
import { http, getAddress, type Hex } from 'viem';
import {
  getChain,
  getWallets,
  readDeploymentData,
  setAssumeProven,
  type L1ComboWallet,
} from '@turnstile-portal/turnstile-dev';

import { commonOpts } from '@turnstile-portal/deploy/commands';

import {
  L1Token,
  L1TokenPortal,
  AztecToken,
  AztecTokenPortal,
} from '@turnstile-portal/turnstile.js';

async function initiateL2Withdrawal({
  l2Wallet,
  l2TokenAddr,
  l2PortalAddr,
  pxe,
  l1TokenAddr,
  l1Recipient,
  amount,
}: {
  l2Wallet: AccountWallet;
  l2TokenAddr: AztecAddress;
  l2PortalAddr: AztecAddress;
  l1Recipient: Hex;
  l1TokenAddr: Hex;
  pxe: PXE;
  amount: bigint;
}) {
  const l2Token = await AztecToken.getToken(l2TokenAddr, l2Wallet);

  console.log(
    `Initiating withdrawal of ${amount} ${await l2Token.symbol()} to L1 recipient ${l1Recipient}`,
  );
  console.log(
    'Current L2 balance:',
    await l2Token.balanceOfPublic(l2Token.wallet.getAddress()),
  );

  const { action, nonce } = await l2Token.burnAuthWitAction(
    l2Wallet.getAddress(),
    amount,
  );

  const sendAuthWit = await (
    await l2Wallet.setPublicAuthWit(
      {
        caller: l2PortalAddr,
        action,
      },
      true, // Authorize the action
    )
  ).send();

  console.log(
    'Sending burn auth wit transaction:',
    (await sendAuthWit.getTxHash()).toString(),
  );

  const authWitReceipt = await sendAuthWit.wait();
  if (authWitReceipt.status !== TxStatus.SUCCESS) {
    throw new Error('Failed to authorize burn action');
  }

  const l2Portal = new AztecTokenPortal(l2PortalAddr.toString(), pxe, l2Wallet);

  // Initiate the withdrawal from the Turnstile Portal
  const { tx, leaf } = await l2Portal.withdrawPublic(
    l1TokenAddr,
    l1Recipient,
    amount,
    nonce,
  );

  console.log(
    `Withdrawal initiated on L2. Tx: ${(await tx.getTxHash()).toString()}`,
  );
  console.log(`L2 to L1 message leaf: ${leaf}`);

  const receipt = await tx.wait({ debug: true }); // `debug: true` gives us `debugInfo` in the receipt
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
    await l2Token.balanceOfPublic(l2Token.wallet.getAddress()),
  );

  const withdrawData = AztecTokenPortal.encodeWithdrawData(
    l1TokenAddr,
    l1Recipient,
    amount,
  );

  return { l2BlockNumber, leaf, withdrawData };
}

async function completeL1Withdrawal({
  l1Wallet,
  l1TokenAddr,
  l1Portal,
  withdrawData,
  l2BlockNumber,
  leaf,
  node,
}: {
  l1Wallet: L1ComboWallet;
  l1TokenAddr: Hex;
  l1Portal: L1TokenPortal;
  withdrawData: Hex;
  l2BlockNumber: bigint;
  node: AztecNode;
  leaf: Fr;
}) {
  console.log('Waiting for L2 block to be available on L1...');
  await l1Portal.waitForAztecBlockOnL1(
    l2BlockNumber,
    60, // Timeout in seconds
  );

  const [l2ToL1MessageIndex, siblingPath] =
    await node.getL2ToL1MessageMembershipWitness(Number(l2BlockNumber), leaf);

  const l1Token = new L1Token(l1Wallet.wallet, l1Wallet.public);
  console.log(
    `Current L1 balance: ${await l1Token.balanceOf(l1TokenAddr, l1Wallet.wallet.account.address)}`,
  );

  const tx = await l1Portal.withdraw(
    withdrawData,
    l2BlockNumber,
    l2ToL1MessageIndex,
    siblingPath,
  );
  console.log(`L1 Withdraw transaction hash: ${tx}`);

  const receipt = await l1Wallet.public.waitForTransactionReceipt({ hash: tx });
  if (receipt.status !== 'success') {
    throw new Error(`L1 Withdraw transaction failed: ${receipt.status}`);
  }
  console.log('L1 Withdrawal complete');
  console.log(
    `New L1 balance: ${await l1Token.balanceOf(l1TokenAddr, l1Wallet.wallet.account.address)}`,
  );
}

export function registerWithdrawTokens(program: Command) {
  return program
    .command('withdraw-tokens')
    .description('Withdraw tokens from L2 to L1')
    .addOption(commonOpts.keys)
    .addOption(commonOpts.pxe)
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
      const l1TokenAddr = tokenInfo.l1Address;
      const l1RollupAddr = deploymentData.rollupAddress;

      const pxe = createPXEClient(options.pxe);
      const node = createAztecNodeClient(options.pxe);

      const { l1Wallet, l2Wallet } = await getWallets(
        pxe,
        {
          chain: getChain(options.l1Chain),
          transport: http(options.rpc),
        },
        options.keys,
      );

      const l1Recipient = options.l1RecipientAddr
        ? getAddress(options.l1Recipient)
        : l1Wallet.wallet.account.address;
      const amount = BigInt(options.amount);

      const { l2BlockNumber, leaf, withdrawData } = await initiateL2Withdrawal({
        l2Wallet,
        l2TokenAddr,
        l2PortalAddr: AztecAddress.fromString(deploymentData.aztecPortal),
        l1TokenAddr,
        l1Recipient,
        amount,
        pxe,
      });

      // Wait for the L2 block to be available on the L1 chain
      const l1Portal = new L1TokenPortal(
        getAddress(deploymentData.l1Portal),
        l1Wallet.wallet,
        l1Wallet.public,
      );

      // Cheat to make the L2 block available on L1
      await setAssumeProven(options.rpc, l1RollupAddr, l2BlockNumber);
      console.log(
        `Waiting for L2 block ${l2BlockNumber} to be available on L1...`,
      );
      await l1Portal.waitForAztecBlockOnL1(l2BlockNumber, 60);

      // L2 block is available. Withdraw the tokens on L1 chain.
      await completeL1Withdrawal({
        l1Wallet,
        l1TokenAddr,
        l1Portal,
        withdrawData,
        l2BlockNumber,
        leaf,
        node,
      });
    });
}
