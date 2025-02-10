import type { Command } from 'commander';
import { createPXEClient, AztecAddress } from '@aztec/aztec.js';
import type { Wallet } from '@aztec/aztec.js';
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import {
  getL2Wallet,
  readDeploymentData,
  readKeyData,
} from '@turnstile-portal/turnstile-dev';

import { commonOpts } from '@turnstile-portal/deploy/commands';

import { AztecToken } from '@turnstile-portal/turnstile.js';

async function doTransfer(
  wallet: Wallet,
  tokenAddr: AztecAddress,
  recipient: AztecAddress,
  amount: bigint,
) {
  const token = await AztecToken.getToken(tokenAddr, wallet);
  const symbol = await token.symbol();
  console.log(`Transferring ${amount} ${symbol} to ${recipient}...`);

  const balance = await token.balanceOfPublic(wallet.getAddress());
  console.log(`Current balance: ${balance}`);
  if (balance < amount) {
    throw new Error('Insufficient balance');
  }

  const tx = await token.transferPublic(recipient, amount);
  console.log(
    `Transaction submitted: ${await tx.getTxHash()}\nWaiting for receipt...`,
  );
  const receipt = await tx.wait();
  console.log('Transfer status:', receipt.status);
  return receipt;
}

export function registerAztecTransferPublic(program: Command) {
  return program
    .command('aztec-transfer-public')
    .description('Transfer Aztec tokens publicly')
    .addOption(commonOpts.keys)
    .addOption(commonOpts.pxe)
    .addOption(commonOpts.rpc)
    .addOption(commonOpts.deploymentData)
    .option('--token <symbol>', 'Token Symbol', 'TT1')
    .option('--amount <a>', 'Amount', '1000')
    .option('--recipient <address>', 'Recipient address')
    .action(async (options) => {
      const deploymentData = await readDeploymentData(options.deploymentData);
      const tokenInfo = deploymentData.tokens[options.token];
      if (!tokenInfo) {
        throw new Error(`Token ${options.token} not found in deployment data`);
      }
      const tokenAddr = AztecAddress.fromString(tokenInfo.l2Address);

      const pxe = createPXEClient(options.pxe);

      const wallet = await getL2Wallet(pxe, await readKeyData(options.keys));
      const amount = BigInt(options.amount);

      const aztecTestWallets = await getInitialTestAccountsWallets(pxe);

      function recipientError(msg: string): Error {
        console.log(msg);
        console.log('Please use one of the following test addresses:');
        for (const wallet of aztecTestWallets) {
          console.log(wallet.getAddress().toString());
        }
        return new Error(msg);
      }

      if (!options.recipient) {
        throw recipientError('Recipient address not provided');
      }

      const recipient = AztecAddress.fromString(options.recipient);

      const initialRecipientBalance = await (
        await AztecToken.getToken(tokenAddr, wallet)
      ).balanceOfPublic(recipient);
      console.log(
        `Initial recipient balance (${recipient}): ${initialRecipientBalance}`,
      );

      const initialSenderBalance = await (
        await AztecToken.getToken(tokenAddr, wallet)
      ).balanceOfPublic(wallet.getAddress());
      console.log(
        `Initial sender balance (${wallet.getAddress()}): ${initialSenderBalance}`,
      );

      await doTransfer(wallet, tokenAddr, recipient, amount);

      const finalRecipientBalance = await (
        await AztecToken.getToken(tokenAddr, wallet)
      ).balanceOfPublic(recipient);
      console.log(
        `Final recipient balance (${recipient}): ${finalRecipientBalance}`,
      );

      const finalSenderBalance = await (
        await AztecToken.getToken(tokenAddr, wallet)
      ).balanceOfPublic(wallet.getAddress());
      console.log(
        `Final sender balance (${wallet.getAddress()}): ${finalSenderBalance}`,
      );
    });
}
