import type { Command } from 'commander';
import { createPXEClient, TxStatus } from '@aztec/aztec.js';
import { http, getAddress } from 'viem';
import type { Address } from 'viem';
import {
  advanceBlocksUntil,
  getChain,
  getWallets,
  readDeploymentData,
  InsecureMintableToken,
  type L1ComboWallet,
} from '@turnstile-portal/turnstile-dev';

import { commonOpts } from '@turnstile-portal/deploy/commands';

import {
  L1TokenPortal,
  AztecTokenPortal,
} from '@turnstile-portal/turnstile.js';

async function l1MintAndDeposit({
  l1PortalAddr,
  tokenAddr,
  l2RecipientAddr,
  amount,
  l1Wallet,
}: {
  l1PortalAddr: Address;
  tokenAddr: Address;
  l2RecipientAddr: string;
  amount: bigint;
  l1Wallet: L1ComboWallet;
}): Promise<{ hash: string; l2BlockNumber: number; index: number }> {
  const tokenClient = new InsecureMintableToken(
    l1Wallet.wallet,
    l1Wallet.public,
  );

  // Mint tokens to the wallet holder
  // Minting is for testing only
  await tokenClient.mint(tokenAddr, l1Wallet.wallet.account.address, amount);

  // Approve the Token Portal to spend the tokens. Required before depositing.
  await tokenClient.approve(tokenAddr, l1PortalAddr, amount);

  // Deposit the tokens to the L2 network
  const portal = new L1TokenPortal(
    l1PortalAddr,
    l1Wallet.wallet,
    l1Wallet.public,
  );
  const receipt = await portal.deposit(tokenAddr, l2RecipientAddr, amount);
  if (receipt.status !== 'success') {
    throw new Error(`deposit() failed: ${receipt}`);
  }
  console.log(
    `L1 Deposit successful. Transaction hash: ${receipt.transactionHash}`,
  );

  const {
    token: _tokenAddr,
    sender,
    hash,
    index,
  } = L1TokenPortal.parseDepositLog(receipt);
  console.log(
    `Log: Deposit(token: ${_tokenAddr}, sender: ${sender}, hash: ${hash}, index: ${index})`,
  );

  const { l2BlockNumber } = L1TokenPortal.parseMessageSentLog(receipt);
  console.log(
    `Log: MessageSent(l2BlockNumber: ${l2BlockNumber}, index: ${index}, hash: ${hash})`,
  );

  // Sanity check.  using `getAddress` to ensure the address is checksummed.
  if (
    _tokenAddr !== getAddress(tokenAddr) ||
    sender !== getAddress(l1Wallet.wallet.account.address)
  ) {
    throw new Error('Deposit log mismatch');
  }

  return { hash, l2BlockNumber: Number(l2BlockNumber), index: Number(index) };
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

      const { l1Wallet, l2Wallet } = await getWallets(
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
        : l2Wallet.getAddress().toString();

      const { index, hash, l2BlockNumber } = await l1MintAndDeposit({
        l1PortalAddr: getAddress(deploymentData.l1Portal),
        tokenAddr: getAddress(l1TokenAddr),
        l2RecipientAddr: l2Recipient,
        amount,
        l1Wallet,
      });

      // We need to wait for the L2 block to be mined so that the L1ToL2Message is available on the L2 chain.
      // In a real scenario, we would wait for the L2 blocks to be mined naturally, but for testing purposes
      // we will advance the blocks ourselves.
      await advanceBlocksUntil(
        pxe,
        l2Wallet,
        deploymentData.devAdvanceBlock,
        l2BlockNumber,
      );

      const aztecPortal = new AztecTokenPortal(
        deploymentData.aztecPortal,
        pxe,
        l2Wallet,
      );

      const tx = await aztecPortal.claimDeposit(
        getAddress(l1TokenAddr),
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
