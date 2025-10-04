import { TxStatus } from '@aztec/aztec.js';
import { getConfigPaths, loadDeployConfig } from '@turnstile-portal/deploy';
import { type L2Client, type L2Token, TurnstileFactory } from '@turnstile-portal/turnstile.js';
import { createL2Client, readKeyData } from '@turnstile-portal/turnstile-dev';
import type { Command } from 'commander';

async function doBatchOperations(l2Client: L2Client, token: L2Token) {
  const symbol = await token.getSymbol();
  console.log(`Performing batch operations with ${symbol}...`);

  const address = l2Client.getAddress();
  const publicBalance = await token.balanceOfPublic(address);
  const privateBalance = await token.balanceOfPrivate(address);
  console.log(`Initial public balance: ${publicBalance}`);
  console.log(`Initial private balance: ${privateBalance}`);

  // Create a batch of operations
  const batch = token.batch();

  // Add multiple operations to the batch
  const shieldAmount = publicBalance / 3n;
  const unshieldAmount = privateBalance / 4n;

  if (shieldAmount > 0) {
    console.log(`Adding shield operation for ${shieldAmount} tokens`);
    batch.addShield(token.shield(shieldAmount));
  }

  if (unshieldAmount > 0) {
    console.log(`Adding unshield operation for ${unshieldAmount} tokens`);
    batch.addUnshield(token.unshield(unshieldAmount));
  }

  if (batch.size() === 0) {
    console.log('No operations to perform (insufficient balances)');
    return null;
  }

  console.log(`Executing batch with ${batch.size()} operations...`);
  const tx = batch.send({ from: address });
  console.log(`Transaction submitted: ${await tx.getTxHash()}`);
  return tx;
}

export function registerBatchTokenOperations(program: Command) {
  return program
    .command('batch-token-operations')
    .description('Execute multiple token operations in a single transaction')
    .option('--token <symbol>', 'Token symbol', 'TT1')
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

      // Create token & ensure L2 Token is registered in the PXE
      const token = await factory.createL2Token(l2Client, tokenInfo);

      const tx = await doBatchOperations(l2Client, token);
      if (tx) {
        const receipt = await tx.wait();
        if (receipt.status !== TxStatus.SUCCESS) {
          throw new Error(`Batch operations failed: ${receipt}`);
        }
        console.log('Batch operations successful!');

        // Check final balances
        const finalPublicBalance = await token.balanceOfPublic(l2Client.getAddress());
        const finalPrivateBalance = await token.balanceOfPrivate(l2Client.getAddress());
        console.log(`Final public balance: ${finalPublicBalance}`);
        console.log(`Final private balance: ${finalPrivateBalance}`);
      }
    });
}
