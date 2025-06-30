import type { Command } from 'commander';
import { AztecAddress, TxStatus } from '@aztec/aztec.js';
import { readKeyData, createL2Client } from '@turnstile-portal/turnstile-dev';

import { commonOpts } from '@turnstile-portal/deploy/commands';

import {
  L2Token,
  type L2Client,
  TurnstileFactory,
} from '@turnstile-portal/turnstile.js';

async function doUnshield(l2Client: L2Client, token: L2Token, amount: bigint) {
  const symbol = await token.getSymbol();
  console.log(`Unshielding ${amount} ${symbol}...`);

  const balance = await token.balanceOfPrivate(l2Client.getAddress());
  console.log(`Current private balance: ${balance}`);
  if (balance < amount) {
    throw new Error('Insufficient balance.');
  }

  const tx = await token.unshield(amount);
  console.log(`Transaction submitted: ${await tx.getTxHash()}`);
  return tx;
}

export function registerUnshieldTokens(program: Command) {
  return program
    .command('unshield-tokens')
    .description('Unshield tokens')
    .addOption(commonOpts.keys)
    .addOption(commonOpts.aztecNode)
    .addOption(commonOpts.rpc)
    .addOption(commonOpts.deploymentData)
    .option('--token <symbol>', 'Token Symbol', 'TT1')
    .option('--amount <a>', 'Amount', '10000')
    .action(async (options) => {
      const factory = await TurnstileFactory.fromConfig(options.deploymentData);
      const tokenInfo = factory.getTokenInfo(options.token);
      const tokenAddr = AztecAddress.fromString(tokenInfo.l2Address);

      const keyData = await readKeyData(options.keys);
      const l2Client = await createL2Client(options.aztecNode, keyData);
      const amount = BigInt(options.amount);
      const token = await L2Token.fromAddress(tokenAddr, l2Client);
      const startingBalance = await token.balanceOfPublic(
        l2Client.getAddress(),
      );
      const startingPrivateBalance = await token.balanceOfPrivate(
        l2Client.getAddress(),
      );
      // Note: shieldedSupply is not available in the new API

      const tx = await doUnshield(l2Client, token, amount);
      const receipt = await tx.wait();

      if (receipt.status !== TxStatus.SUCCESS) {
        throw new Error(`Unshielding failed: ${receipt}`);
      }

      console.log('Unshielding successful!');

      // Check the balance after the unshield
      const finalBalance = await token.balanceOfPublic(l2Client.getAddress());
      const finalPrivateBalance = await token.balanceOfPrivate(
        l2Client.getAddress(),
      );

      console.log(`Starting public balance: ${startingBalance}`);
      console.log(`Starting private balance: ${startingPrivateBalance}`);

      console.log(`Final public balance: ${finalBalance}`);
      console.log(`Final private balance: ${finalPrivateBalance}`);
    });
}
