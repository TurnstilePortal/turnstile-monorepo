import type { Command } from 'commander';
import { createPXEClient, AztecAddress, TxStatus } from '@aztec/aztec.js';
import type { Wallet } from '@aztec/aztec.js';
import {
  getL2Wallet,
  readDeploymentData,
  readKeyData,
} from '@turnstile-portal/turnstile-dev';

import { commonOpts } from '@turnstile-portal/deploy/commands';

import { AztecToken } from '@turnstile-portal/turnstile.js';

async function doShield(wallet: Wallet, token: AztecToken, amount: bigint) {
  const symbol = await token.symbol();
  console.log(`Shielding ${amount} ${symbol}...`);

  const balance = await token.balanceOfPublic(wallet.getAddress());
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
    .addOption(commonOpts.pxe)
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

      const pxe = createPXEClient(options.pxe);

      const wallet = await getL2Wallet(pxe, await readKeyData(options.keys));
      const amount = BigInt(options.amount);

      const token = await AztecToken.getToken(tokenAddr, wallet);
      const startingBalance = await token.balanceOfPublic(wallet.getAddress());
      const startingPrivateBalance = await token.balanceOfPrivate(
        wallet.getAddress(),
      );
      const startingShieldedSupply = await token.shieldedSupply();

      const tx = await doShield(wallet, token, amount);
      const receipt = await tx.wait();

      if (receipt.status !== TxStatus.SUCCESS) {
        throw new Error(`Shielding failed: ${receipt}`);
      }

      console.log('Shielding successful!');

      // Check the balance after the shield
      const finalBalance = await token.balanceOfPublic(wallet.getAddress());
      const finalPrivateBalance = await token.balanceOfPrivate(
        wallet.getAddress(),
      );
      const finalShieldedSupply = await token.shieldedSupply();

      console.log(`Starting public balance: ${startingBalance}`);
      console.log(`Starting private balance: ${startingPrivateBalance}`);
      console.log(`Starting shielded supply: ${startingShieldedSupply}`);

      console.log(`Final public balance: ${finalBalance}`);
      console.log(`Final private balance: ${finalPrivateBalance}`);
      console.log(`Final shielded supply: ${finalShieldedSupply}`);
    });
}
