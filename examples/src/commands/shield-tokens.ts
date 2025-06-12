import type { Command } from 'commander';
import { AztecAddress, TxStatus } from '@aztec/aztec.js';
import {
  readDeploymentData,
  readKeyData,
  createL2Client,
} from '@turnstile-portal/turnstile-dev';

import { commonOpts } from '@turnstile-portal/deploy/commands';

import { L2Token, type L2Client } from '@turnstile-portal/turnstile.js';

async function doShield(l2Client: L2Client, token: L2Token, amount: bigint) {
  const symbol = await token.getSymbol();
  console.log(`Shielding ${amount} ${symbol}...`);

  const balance = await token.balanceOfPublic(l2Client.getAddress());
  console.log(`Current balance: ${balance}`);
  if (balance < amount) {
    throw new Error('Insufficient balance.');
  }

  const tx = await token.shield(amount);
  console.log(`Transaction submitted: ${await tx.getTxHash()}`);
  return tx;
}

export function registerShieldTokens(program: Command) {
  return program
    .command('shield-tokens')
    .description('Shield tokens')
    .addOption(commonOpts.keys)
    .addOption(commonOpts.aztecNode)
    .addOption(commonOpts.rpc)
    .addOption(commonOpts.deploymentData)
    .option('--token <symbol>', 'Token Symbol', 'TT1')
    .option('--amount <a>', 'Amount', '10000')
    .action(async (options) => {
      const deploymentData = await readDeploymentData(options.deploymentData);
      const tokenInfo = deploymentData.tokens[options.token];
      if (!tokenInfo) {
        throw new Error(`Token ${options.token} not found in deployment data`);
      }
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

      const tx = await doShield(l2Client, token, amount);
      const receipt = await tx.wait();

      if (receipt.status !== TxStatus.SUCCESS) {
        throw new Error(`Shielding failed: ${receipt}`);
      }

      console.log('Shielding successful!');

      // Check the balance after the shield
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
