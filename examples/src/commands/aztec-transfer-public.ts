import { AztecAddress } from '@aztec/aztec.js';
import {
  type L2Client,
  L2Token,
  TurnstileFactory,
} from '@turnstile-portal/turnstile.js';
import { createL2Client, readKeyData } from '@turnstile-portal/turnstile-dev';
import type { Command } from 'commander';

async function doTransfer(
  l2Client: L2Client,
  tokenAddr: AztecAddress,
  recipient: AztecAddress,
  amount: bigint,
) {
  const token = await L2Token.fromAddress(tokenAddr, l2Client);
  const symbol = await token.getSymbol();
  console.log(`Transferring ${amount} ${symbol} to ${recipient}...`);

  const balance = await token.balanceOfPublic(l2Client.getAddress());
  console.log(`Current balance: ${balance}`);
  if (balance < amount) {
    throw new Error('Insufficient balance');
  }

  const tx = await token.transferPublic(recipient, amount);
  console.log(
    `Transaction submitted: ${await tx.getTxHash()}\nWaiting for receipt...`,
  );
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

      const recipient = AztecAddress.fromString(options.recipient);

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

      const initialRecipientBalance = await (
        await L2Token.fromAddress(tokenAddr, l2Client)
      ).balanceOfPublic(recipient);
      console.log(
        `Initial recipient balance (${recipient}): ${initialRecipientBalance}`,
      );

      const initialSenderBalance = await (
        await L2Token.fromAddress(tokenAddr, l2Client)
      ).balanceOfPublic(l2Client.getAddress());
      console.log(
        `Initial sender balance (${l2Client.getAddress()}): ${initialSenderBalance}`,
      );

      await doTransfer(l2Client, tokenAddr, recipient, amount);

      const finalRecipientBalance = await (
        await L2Token.fromAddress(tokenAddr, l2Client)
      ).balanceOfPublic(recipient);
      console.log(
        `Final recipient balance (${recipient}): ${finalRecipientBalance}`,
      );

      const finalSenderBalance = await (
        await L2Token.fromAddress(tokenAddr, l2Client)
      ).balanceOfPublic(l2Client.getAddress());
      console.log(
        `Final sender balance (${l2Client.getAddress()}): ${finalSenderBalance}`,
      );
    });
}
