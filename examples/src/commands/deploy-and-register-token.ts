import type { Command } from 'commander';
import { randomBytes } from 'node:crypto';
import { createPXEClient, AztecAddress, TxStatus } from '@aztec/aztec.js';
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
  L1AllowList,
  L1TokenPortal,
  AztecToken,
  AztecTokenPortal,
} from '@turnstile-portal/turnstile.js';

async function deployRandomToken(l1Wallet: L1ComboWallet) {
  const suffix = randomBytes(4).toString('hex');
  const tokenName = `TestToken${suffix}`;
  const tokenSymbol = `TT${suffix}`;
  const tokenDecimals = 18;
  const tokenClient = new InsecureMintableToken(
    l1Wallet.wallet,
    l1Wallet.public,
  );
  const token = await tokenClient.deployInsecureMintableToken(
    tokenName,
    tokenSymbol,
    tokenDecimals,
  );
  console.log(`Deployed L1 token ${tokenSymbol} at ${token}`);

  return {
    token,
    tokenName,
    tokenSymbol,
    tokenDecimals,
  };
}

export function registerDeployAndRegisterToken(program: Command) {
  return program
    .command('deploy-and-register-token')
    .description(
      'Deploy a token on L1 and register it with the Turnstile Portal on L1 & L2',
    )
    .addOption(commonOpts.keys)
    .addOption(commonOpts.pxe)
    .addOption(commonOpts.l1Chain)
    .addOption(commonOpts.rpc)
    .addOption(commonOpts.deploymentData)
    .action(async (options) => {
      const deploymentData = await readDeploymentData(options.deploymentData);
      const pxe = createPXEClient(options.pxe);
      const { l1Wallet, l2Wallet } = await getWallets(
        pxe,
        {
          chain: getChain(options.l1Chain),
          transport: http(options.rpc),
        },
        options.keys,
      );

      const l1PortalAddr = deploymentData.l1Portal;
      const aztecPortalAddr = deploymentData.aztecPortal;

      const { token, tokenName, tokenSymbol, tokenDecimals } =
        await deployRandomToken(l1Wallet);

      const l1Portal = new L1TokenPortal(
        getAddress(l1PortalAddr),
        l1Wallet.wallet,
        l1Wallet.public,
      );

      const allowList = new L1AllowList(
        getAddress(deploymentData.l1AllowList),
        l1Wallet.wallet,
        l1Wallet.public,
      );

      // Propose the token to the allowlist
      const proposeReceipt = await allowList.propose(token);
      if (proposeReceipt.status !== 'success') {
        throw new Error(`propose() failed: ${proposeReceipt}`);
      }
      console.log(
        `Proposed token ${tokenSymbol} to portal in tx ${proposeReceipt.transactionHash}`,
      );

      // Accept the token to the allowlist. Needs the approver wallet to approve the request.
      // In a real scenario, the approver would be a different actor than the proposer and there
      // would be a process to approve the proposal.
      const approverWallet = l1Wallet.wallet;
      const acceptReceipt = await allowList.accept(token, approverWallet);
      if (acceptReceipt.status !== 'success') {
        throw new Error(`accept() failed: ${acceptReceipt}`);
      }
      console.log(`Accepted proposal in tx ${acceptReceipt.transactionHash}`);

      // Register the token with the L1 Portal
      const registerReceipt = await l1Portal.register(token);
      if (registerReceipt.status !== 'success') {
        throw new Error(`register() failed: ${registerReceipt}`);
      }
      console.log(
        `Registered token ${tokenSymbol} with the L1 Portal in tx ${registerReceipt.transactionHash}`,
      );

      // Decode the logs to get the L2 token registration details
      const { token: tokenAddr, hash } =
        L1TokenPortal.parseRegisterLog(registerReceipt);
      console.log(`Log: Registered(token: ${tokenAddr}, hash: ${hash})`);
      const {
        l2BlockNumber,
        index,
        hash: messageHash,
      } = L1TokenPortal.parseMessageSentLog(registerReceipt);
      console.log(
        `Log: MessageSent(l2BlockNumber: ${l2BlockNumber}, index: ${index}, hash: ${messageHash})`,
      );

      // Register the token with the L2 Portal

      // First we need to deploy the L2 token contract with the correct parameters (aztecPortal, name, symbol, decimals matching the L1 token)
      const aztecToken = await AztecToken.deploy(
        l2Wallet,
        AztecAddress.fromString(aztecPortalAddr),
        tokenName,
        tokenSymbol,
        tokenDecimals,
      );

      // We need to wait for the L2 block to be mined so that the L1ToL2Message is available on the L2 chain.
      // In a real scenario, we would wait for the L2 blocks to be mined naturally, but for testing purposes
      // we will advance the blocks ourselves.
      await advanceBlocksUntil(
        pxe,
        l2Wallet,
        deploymentData.devAdvanceBlock,
        Number(l2BlockNumber),
      );

      // Now register our newly deployed token to the L2 Portal
      const aztecPortal = new AztecTokenPortal(aztecPortalAddr, pxe, l2Wallet);

      const registerTokenTx = await aztecPortal.registerToken(
        tokenAddr,
        aztecToken.address(),
        tokenName,
        tokenSymbol,
        tokenDecimals,
        index,
      );
      console.log(
        `Transaction submitted: ${await registerTokenTx.getTxHash()}\nWaiting for receipt...`,
      );
      const aztecRegisterReceipt = await registerTokenTx.wait();
      if (aztecRegisterReceipt.status !== TxStatus.SUCCESS) {
        throw new Error(
          `registerToken() failed. status: ${aztecRegisterReceipt.status}`,
        );
      }
      console.log(
        `Token ${tokenSymbol} registered with the Aztec Portal in tx ${aztecRegisterReceipt.txHash}`,
      );
    });
}
