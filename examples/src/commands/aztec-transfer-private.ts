import type { Command } from 'commander';
import {
  createAztecNodeClient,
  createPXEClient,
  AztecAddress,
  Fr,
  TxStatus,
} from '@aztec/aztec.js';
import type { AztecNode, PXE, Wallet } from '@aztec/aztec.js';
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import {
  readDeploymentData,
  readKeyData,
  createL2Client,
} from '@turnstile-portal/turnstile-dev';

import { commonOpts } from '@turnstile-portal/deploy/commands';

import { L2Token, L2Client } from '@turnstile-portal/turnstile.js';

// Create a proper L2Client from a Wallet
function createL2ClientFromWallet(wallet: Wallet, node: AztecNode): L2Client {
  return new L2Client(node, wallet);
}

async function doTransfer(
  l2Client: L2Client,
  tokenAddr: AztecAddress,
  recipient: AztecAddress,
  amount: bigint,
) {
  const token = await L2Token.fromAddress(tokenAddr, l2Client);

  const symbol = await token.getSymbol();
  console.log(`PRIVATELY Transferring ${amount} ${symbol} to ${recipient}...`);

  const balance = await token.balanceOfPrivate(l2Client.getAddress());
  if (balance < amount) {
    throw new Error('Insufficient balance');
  }

  // TODO: Use a correctly formatted verified ID
  const verifiedID: Fr[] & { length: 5 } = [
    Fr.fromHexString('0x01'),
    Fr.fromHexString('0x02'),
    Fr.fromHexString('0x03'),
    Fr.fromHexString('0x04'),
    Fr.fromHexString('0x05'),
  ];
  console.log('Using Verified ID:', verifiedID);

  const tx = await token.transferPrivate(recipient, amount, verifiedID);
  console.log(
    `Transaction submitted: ${await tx.getTxHash()}\nWaiting for receipt...`,
  );
  const receipt = await tx.wait();
  console.log('Transfer status:', receipt.status);
  if (receipt.status !== TxStatus.SUCCESS) {
    throw new Error('Transfer failed');
  }
}

export function registerAztecTransferPrivate(program: Command) {
  return program
    .command('aztec-transfer-private-verified-id')
    .description('Transfer Aztec tokens privately using a verified ID')
    .addOption(commonOpts.keys)
    .addOption(commonOpts.pxe)
    .addOption(commonOpts.aztecNode)
    .addOption(commonOpts.rpc)
    .addOption(commonOpts.deploymentData)
    .option('--token <symbol>', 'Token Symbol', 'TT1')
    .option('--amount <a>', 'Amount', '100')
    .option('--recipient <address>', 'Recipient address')
    .action(async (options) => {
      const deploymentData = await readDeploymentData(options.deploymentData);
      const tokenInfo = deploymentData.tokens[options.token];
      if (!tokenInfo) {
        throw new Error(`Token ${options.token} not found in deployment data`);
      }
      const tokenAddr = AztecAddress.fromString(tokenInfo.l2Address);

      const node = createAztecNodeClient(options.aztecNode);
      const pxe = createPXEClient(options.pxe);
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
      const recipientWallet = aztecTestWallets.find((wallet) =>
        wallet.getAddress().equals(recipient),
      );
      if (!recipientWallet) {
        throw recipientError('Recipient wallet not found');
      }

      const keyData = await readKeyData(options.keys);
      const senderClient = await createL2Client(options.aztecNode, keyData);
      const amount = BigInt(options.amount);

      const recipientClient = createL2ClientFromWallet(recipientWallet, node);
      const initialRecipientBalance = await (
        await L2Token.fromAddress(tokenAddr, recipientClient)
      ).balanceOfPrivate(recipient);
      console.log(
        `Initial recipient balance (${recipient}): ${initialRecipientBalance}`,
      );

      const initialSenderBalance = await (
        await L2Token.fromAddress(tokenAddr, senderClient)
      ).balanceOfPrivate(senderClient.getAddress());
      console.log(
        `Initial sender balance (${senderClient.getAddress()}): ${initialSenderBalance}`,
      );

      await doTransfer(senderClient, tokenAddr, recipient, amount);

      const endingRecipientBalance = await (
        await L2Token.fromAddress(tokenAddr, recipientClient)
      ).balanceOfPrivate(recipient);
      console.log(
        `Final recipient balance (${recipient}): ${endingRecipientBalance}`,
      );

      const endingSenderBalance = await (
        await L2Token.fromAddress(tokenAddr, senderClient)
      ).balanceOfPrivate(senderClient.getAddress());
      console.log(
        `Final sender balance (${senderClient.getAddress()}): ${endingSenderBalance}`,
      );
    });
}
