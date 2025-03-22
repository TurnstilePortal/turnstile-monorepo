import type { Command } from 'commander';
import {
  createAztecNodeClient,
  createPXEClient,
  AztecAddress,
  TxStatus,
} from '@aztec/aztec.js';
import type { Wallet } from '@aztec/aztec.js';
import {
  readDeploymentData,
  readKeyData,
  createL2Client,
} from '@turnstile-portal/turnstile-dev';

import { commonOpts } from '@turnstile-portal/deploy/commands';

import {
  L2Token,
  type IL2Client,
  L2Client,
} from '@turnstile-portal/turnstile.js';

// Create a proper L2Client from a Wallet
function createL2ClientFromWallet(wallet: Wallet): L2Client {
  // Get PXE from wallet's internal properties
  // @ts-expect-error Accessing internal wallet properties for backward compatibility
  const pxe = wallet.client || wallet.pxe;
  if (!pxe) {
    throw new Error('Cannot get PXE client from wallet');
  }

  // Create a new L2Client with the wallet and PXE
  return new L2Client(pxe, wallet);
}

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
    .addOption(commonOpts.pxe)
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

      const pxe = createPXEClient(options.pxe);
      const node = createAztecNodeClient(options.aztecNode);

      const keyData = await readKeyData(options.keys);
      const l2Client = await createL2Client(pxe, node, keyData);
      const amount = BigInt(options.amount);
      const token = await L2Token.fromAddress(tokenAddr, l2Client);
      const startingBalance = await token.balanceOfPublic(
        l2Client.getAddress(),
      );
      const startingPrivateBalance = await token.balanceOfPrivate(
        l2Client.getAddress(),
      );
      // Note: shieldedSupply is not available in the new API
      // const startingShieldedSupply = 0n;

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
