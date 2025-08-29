import { AztecAddress, TxStatus } from '@aztec/aztec.js';
import {
  type L2Client,
  L2Token,
  TurnstileFactory,
} from '@turnstile-portal/turnstile.js';
import { createL2Client, readKeyData } from '@turnstile-portal/turnstile-dev';
import type { Command } from 'commander';

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
    .option('--token <symbol>', 'Token symbol', 'TT1')
    .option('--amount <amount>', 'Amount to unshield', '10000')
    .action(async (options, command) => {
      // Get global and local options together
      const allOptions = command.optsWithGlobals();
      if (!allOptions.configDir) {
        throw new Error(
          'Config directory is required. Use -c or --config-dir option.',
        );
      }

      // Load configuration from files
      const configDir = allOptions.configDir;
      const configPaths = await import('@turnstile-portal/deploy').then((m) =>
        m.getConfigPaths(configDir),
      );
      const config = await import('@turnstile-portal/deploy').then((m) =>
        m.loadDeployConfig(configPaths.configFile),
      );

      // Use the deployment data from config directory
      const factory = await TurnstileFactory.fromConfig(
        configPaths.deploymentFile,
      );

      // Get token from command option
      const tokenSymbol = options.token;
      const tokenInfo = factory.getTokenInfo(tokenSymbol);
      const tokenAddr = AztecAddress.fromString(tokenInfo.l2Address);

      const keyData = await readKeyData(configPaths.keysFile);
      const l2Client = await createL2Client(
        { node: config.connection.aztec.node },
        keyData,
      );
      const amount = BigInt(options.amount);

      // Ensure L2 Token is registered in the PXE
      console.log(`Registering Token in PXE: ${tokenAddr.toString()}`);
      await L2Token.register(
        l2Client,
        tokenAddr,
        AztecAddress.fromString(factory.getDeploymentData().aztecPortal),
        tokenInfo.name,
        tokenInfo.symbol,
        tokenInfo.decimals,
      );

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
