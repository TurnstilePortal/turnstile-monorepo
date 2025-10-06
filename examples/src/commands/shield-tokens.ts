import { TxStatus } from '@aztec/aztec.js';
import { getConfigPaths, loadDeployConfig } from '@turnstile-portal/deploy';
import { type L2Client, type L2Token, TurnstileFactory } from '@turnstile-portal/turnstile.js';
import { createL2Client, readKeyData } from '@turnstile-portal/turnstile-dev';
import type { Command } from 'commander';

async function doShield(l2Client: L2Client, token: L2Token, amount: bigint) {
  const symbol = await token.getSymbol();
  console.log(`Shielding ${amount} ${symbol}...`);

  const balance = await token.balanceOfPublic(l2Client.getAddress());
  console.log(`Current balance: ${balance}`);
  if (balance < amount) {
    throw new Error('Insufficient balance.');
  }

  const tx = token.shield(amount).send({ from: l2Client.getAddress() });
  console.log(`Transaction submitted: ${await tx.getTxHash()}`);
  return tx;
}

export function registerShieldTokens(program: Command) {
  return program
    .command('shield-tokens')
    .description('Shield tokens')
    .option('--token <symbol>', 'Token symbol', 'TT1')
    .option('--amount <amount>', 'Amount to shield', '10000')
    .action(async (options, command) => {
      // Get global and local options together
      const allOptions = command.optsWithGlobals();
      if (!allOptions.configDir) {
        throw new Error('Config directory is required. Use -c or --config-dir option.');
      }

      // Load configuration from files
      const configDir = allOptions.configDir;
      const configPaths = getConfigPaths(configDir);
      const config = await loadDeployConfig(configPaths.configFile);

      // Use the deployment data from config directory
      const factory = await TurnstileFactory.fromConfig(configPaths.deploymentFile);

      // Get token from command option
      const tokenSymbol = options.token;
      const tokenInfo = factory.getTokenInfo(tokenSymbol);

      const keyData = await readKeyData(configPaths.keysFile);
      const l2Client = await createL2Client({ node: config.connection.aztec.node }, keyData);

      // Get amount from command option
      const amount = BigInt(options.amount);

      // Create token & ensure L2 Token is registered in the PXE
      const token = await factory.createL2Token(l2Client, tokenInfo);
      const startingBalance = await token.balanceOfPublic(l2Client.getAddress());
      const startingPrivateBalance = await token.balanceOfPrivate(l2Client.getAddress());

      const tx = await doShield(l2Client, token, amount);
      const receipt = await tx.wait();

      if (receipt.status !== TxStatus.SUCCESS) {
        throw new Error(`Shielding failed: ${receipt}`);
      }

      console.log('Shielding successful!');

      // Check the balance after the shield
      const finalBalance = await token.balanceOfPublic(l2Client.getAddress());
      const finalPrivateBalance = await token.balanceOfPrivate(l2Client.getAddress());

      console.log(`Starting public balance: ${startingBalance}`);
      console.log(`Starting private balance: ${startingPrivateBalance}`);

      console.log(`Final public balance: ${finalBalance}`);
      console.log(`Final private balance: ${finalPrivateBalance}`);
    });
}
