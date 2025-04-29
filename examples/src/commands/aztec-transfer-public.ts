import type { Command } from 'commander';
import {
  createAztecNodeClient,
  createPXEClient,
  AztecAddress,
} from '@aztec/aztec.js';
import type { Wallet } from '@aztec/aztec.js';
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import {
  readDeploymentData,
  readKeyData,
  createL2Client,
} from '@turnstile-portal/turnstile-dev';

import { commonOpts } from '@turnstile-portal/deploy/commands';

import {
  L2Token,
  type L2Client,
} from '@turnstile-portal/turnstile.js';

async function doTransfer(
  l2Client: L2Client,
  tokenAddr: AztecAddress,
  recipient: AztecAddress,
  amount: bigint,
) {
  const token = await L2Token.fromAddress(tokenAddr, l2Client);
  const symbol = await token.getSymbol();
  console.log(`Transferring ${amount} ${symbol} to ${recipient}...`);

  const balance = await token.balanceOfPublic(l2Client.getAddress());
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
    .addOption(commonOpts.aztecNode)
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
      const node = createAztecNodeClient(options.aztecNode);

      const keyData = await readKeyData(options.keys);
      const l2Client = await createL2Client(node, keyData);
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
        await L2Token.fromAddress(tokenAddr, l2Client)
      ).balanceOfPublic(recipient);
      console.log(
        `Initial recipient balance (${recipient}): ${initialRecipientBalance}`,
      );

      const initialSenderBalance = await (
        await L2Token.fromAddress(tokenAddr, l2Client)
      ).balanceOfPublic(l2Client.getAddress());
      console.log(
        `Initial sender balance (${l2Client.getAddress()}): ${initialSenderBalance}`,
      );

      await doTransfer(l2Client, tokenAddr, recipient, amount);

      const finalRecipientBalance = await (
        await L2Token.fromAddress(tokenAddr, l2Client)
      ).balanceOfPublic(recipient);
      console.log(
        `Final recipient balance (${recipient}): ${finalRecipientBalance}`,
      );

      const finalSenderBalance = await (
        await L2Token.fromAddress(tokenAddr, l2Client)
      ).balanceOfPublic(l2Client.getAddress());
      console.log(
        `Final sender balance (${l2Client.getAddress()}): ${finalSenderBalance}`,
      );
    });
}
