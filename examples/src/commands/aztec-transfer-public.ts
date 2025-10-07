import { AztecAddress } from '@aztec/aztec.js';
import { getConfigPaths, loadDeployConfig } from '@turnstile-portal/deploy';
import { type IL2Client, type L2Token, TurnstileFactory } from '@turnstile-portal/turnstile.js';
import { createL2Client, readKeyData } from '@turnstile-portal/turnstile-dev';
import type { Command } from 'commander';

async function doTransfer(senderClient: IL2Client, token: L2Token, recipient: AztecAddress, amount: bigint) {
  const symbol = await token.getSymbol();
  console.log(`Transferring ${amount} ${symbol} to ${recipient}...`);

  const tx = token.transferPublic(recipient, amount).send({ from: senderClient.getAddress() });
  console.log(`Transaction submitted: ${await tx.getTxHash()}\nWaiting for receipt...`);
  const receipt = await tx.wait();
  console.log('Transfer status:', receipt.status);
  return receipt;
}

export function registerAztecTransferPublic(program: Command) {
  return program
    .command('aztec-transfer-public')
    .description('Transfer Aztec tokens publicly')
    .option('--token <symbol>', 'Token symbol', 'TT1')
    .option('--amount <amount>', 'Amount to transfer', '1000')
    .requiredOption('--recipient <address>', 'Recipient address (required)')
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
      const tokenAddr = AztecAddress.fromString(tokenInfo.l2Address);

      const keyData = await readKeyData(configPaths.keysFile);
      const l2Client = await createL2Client({ node: config.connection.aztec.node }, keyData);
      const amount = BigInt(options.amount);

      const recipient = AztecAddress.fromString(options.recipient);

      // Ensure L2 Token is registered in the PXE
      console.log(`Registering Token in PXE: ${tokenAddr.toString()}`);
      const l2Token = await factory.createL2Token(l2Client, tokenInfo);

      const initialRecipientBalance = await l2Token
        .balanceOfPrivate(recipient)
        .simulate({ from: l2Client.getAddress() });
      console.log(`Initial recipient balance (${recipient}): ${initialRecipientBalance}`);

      const initialSenderBalance = await l2Token
        .balanceOfPublic(l2Client.getAddress())
        .simulate({ from: l2Client.getAddress() });
      console.log(`Initial sender balance (${l2Client.getAddress()}): ${initialSenderBalance}`);

      if (initialSenderBalance < amount) {
        throw new Error('Insufficient balance');
      }
      await doTransfer(l2Client, l2Token, recipient, amount);

      const finalRecipientBalance = await l2Token.balanceOfPublic(recipient).simulate({ from: l2Client.getAddress() });
      console.log(`Final recipient balance (${recipient}): ${finalRecipientBalance}`);

      const finalSenderBalance = await l2Token
        .balanceOfPublic(l2Client.getAddress())
        .simulate({ from: l2Client.getAddress() });
      console.log(`Final sender balance (${l2Client.getAddress()}): ${finalSenderBalance}`);
    });
}
