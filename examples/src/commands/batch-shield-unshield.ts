import { TxStatus } from '@aztec/aztec.js';
import { getConfigPaths, loadDeployConfig } from '@turnstile-portal/deploy';
import { TurnstileFactory } from '@turnstile-portal/turnstile.js';
import { getChain, getClients } from '@turnstile-portal/turnstile-dev';
import type { Command } from 'commander';
import { http } from 'viem';

/**
 * Example command that demonstrates batching shield and unshield operations
 * Common use cases:
 * 1. Shield multiple tokens for privacy
 * 2. Unshield some for fees, then shield remainder
 * 3. Complex privacy workflows in a single transaction
 */
export function registerBatchShieldUnshield(program: Command) {
  return program
    .command('batch-shield-unshield')
    .description('Batch multiple shield and unshield operations in a single transaction')
    .option('--token <symbol>', 'Token symbol', 'TT1')
    .option('--shield-amount <amount>', 'Amount to shield', '5000')
    .option('--unshield-amount <amount>', 'Amount to unshield', '1000')
    .option('--workflow <type>', 'Workflow type: shield-only, unshield-only, mixed', 'mixed')
    .action(async (options, command) => {
      // Get global and local options
      const allOptions = command.optsWithGlobals();
      if (!allOptions.configDir) {
        throw new Error('Config directory is required. Use -c or --config-dir option.');
      }

      // Load configuration
      const configDir = allOptions.configDir;
      const configPaths = getConfigPaths(configDir);
      const config = await loadDeployConfig(configPaths.configFile);

      // Load factory with deployment data
      const factory = await TurnstileFactory.fromConfig(configPaths.deploymentFile);

      // Get token info
      const tokenSymbol = options.token;
      const tokenInfo = factory.getTokenInfo(tokenSymbol);

      // Get clients
      const { l2Client } = await getClients(
        { node: config.connection.aztec.node },
        {
          chain: getChain(config.connection.ethereum.chainName),
          transport: http(config.connection.ethereum.rpc),
        },
        configPaths.keysFile,
      );

      // Create L2 Token instance
      const l2Token = await factory.createL2Token(l2Client, tokenInfo);

      // Get current balances
      console.log('\n=== Current Balances ===');
      const publicBalance = await l2Token
        .balanceOfPublic(l2Client.getAddress())
        .simulate({ from: l2Client.getAddress() });
      const privateBalance = await l2Token
        .balanceOfPrivate(l2Client.getAddress())
        .simulate({ from: l2Client.getAddress() });
      console.log(`Public balance: ${publicBalance}`);
      console.log(`Private balance: ${privateBalance}`);

      const shieldAmount = BigInt(options.shieldAmount);
      const unshieldAmount = BigInt(options.unshieldAmount);

      // Create batch builder
      const batch = l2Token.batch();

      // Build batch based on workflow type
      console.log(`\n=== Executing ${options.workflow} workflow ===`);

      switch (options.workflow) {
        case 'shield-only':
          // Example: Shield tokens multiple times (e.g., for different privacy sets)
          console.log('Adding multiple shield operations to batch...');
          if (publicBalance >= shieldAmount * 2n) {
            batch.addShield(l2Token.shield(shieldAmount / 2n));
            batch.addShield(l2Token.shield(shieldAmount / 2n));
            console.log(`Batching 2 shield operations of ${shieldAmount / 2n} each`);
          } else if (publicBalance >= shieldAmount) {
            batch.addShield(l2Token.shield(shieldAmount));
            console.log(`Batching 1 shield operation of ${shieldAmount}`);
          } else {
            throw new Error(`Insufficient public balance for shielding. Have: ${publicBalance}, Need: ${shieldAmount}`);
          }
          break;

        case 'unshield-only':
          // Example: Unshield tokens in parts for different purposes
          console.log('Adding multiple unshield operations to batch...');
          if (privateBalance >= unshieldAmount * 2n) {
            batch.addUnshield(l2Token.unshield(unshieldAmount / 2n));
            batch.addUnshield(l2Token.unshield(unshieldAmount / 2n));
            console.log(`Batching 2 unshield operations of ${unshieldAmount / 2n} each`);
          } else if (privateBalance >= unshieldAmount) {
            batch.addUnshield(l2Token.unshield(unshieldAmount));
            console.log(`Batching 1 unshield operation of ${unshieldAmount}`);
          } else {
            throw new Error(
              `Insufficient private balance for unshielding. Have: ${privateBalance}, Need: ${unshieldAmount}`,
            );
          }
          break;

        case 'mixed':
          // Example: Complex workflow - unshield for fees, then shield remainder
          console.log('Adding mixed shield/unshield operations to batch...');

          // First unshield some tokens (e.g., for gas fees)
          if (privateBalance >= unshieldAmount) {
            batch.addUnshield(l2Token.unshield(unshieldAmount));
            console.log(`Added unshield of ${unshieldAmount} (e.g., for fees)`);
          }

          // Then shield public tokens for privacy
          if (publicBalance >= shieldAmount) {
            batch.addShield(l2Token.shield(shieldAmount));
            console.log(`Added shield of ${shieldAmount} for privacy`);
          }

          // Could also add transfers here
          // batch.addTransferPublic(l2Token.transferPublic(recipient, amount));
          break;

        default:
          throw new Error(`Unknown workflow type: ${options.workflow}`);
      }

      // Execute the batch
      console.log('\n=== Executing Batch Transaction ===');
      const batchSize = batch.size();
      console.log(`Executing ${batchSize} operations in a single transaction...`);

      const tx = batch.send({
        from: l2Client.getAddress(),
        fee: l2Client.getFeeOpts(),
      });

      console.log(`Batch transaction submitted: ${await tx.getTxHash()}`);
      const receipt = await tx.wait();

      if (receipt.status !== TxStatus.SUCCESS) {
        throw new Error(`Batch transaction failed: ${receipt.status}`);
      }

      console.log(`✅ Successfully executed ${batchSize} operations in transaction ${receipt.txHash}`);

      // Show updated balances
      console.log('\n=== Updated Balances ===');
      const newPublicBalance = await l2Token
        .balanceOfPublic(l2Client.getAddress())
        .simulate({ from: l2Client.getAddress() });
      const newPrivateBalance = await l2Token
        .balanceOfPrivate(l2Client.getAddress())
        .simulate({ from: l2Client.getAddress() });
      console.log(`Public balance: ${publicBalance} → ${newPublicBalance}`);
      console.log(`Private balance: ${privateBalance} → ${newPrivateBalance}`);

      // Show optimization benefit
      console.log('\n=== Optimization Summary ===');
      console.log(`Operations batched: ${batchSize}`);
      console.log(`Transactions used: 1 (instead of ${batchSize})`);
      console.log(`Gas savings: ~${((batchSize - 1) * 100) / batchSize}%`);
    });
}
