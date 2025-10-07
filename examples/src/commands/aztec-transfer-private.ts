import { getInitialTestAccounts } from '@aztec/accounts/testing';
import { AztecAddress, Fr, TxStatus } from '@aztec/aztec.js';
import { getConfigPaths, loadDeployConfig } from '@turnstile-portal/deploy';
import { type IL2Client, type L2Token, TurnstileFactory } from '@turnstile-portal/turnstile.js';
import { createL2Client, readKeyData } from '@turnstile-portal/turnstile-dev';
import type { Command } from 'commander';

async function doTransfer(
  senderClient: IL2Client,
  token: L2Token,
  recipient: AztecAddress,
  amount: bigint,
): Promise<number> {
  const symbol = await token.getSymbol();
  console.log(`PRIVATELY Transferring ${amount} ${symbol} to ${recipient}...`);

  // TODO: Use a correctly formatted verified ID
  const verifiedID: Fr[] & { length: 5 } = [
    Fr.fromHexString('0x01'),
    Fr.fromHexString('0x02'),
    Fr.fromHexString('0x03'),
    Fr.fromHexString('0x04'),
    Fr.fromHexString('0x05'),
  ];
  console.log('Using Verified ID:', verifiedID);

  const tx = token.transferPrivate(recipient, amount, verifiedID).send({ from: senderClient.getAddress() });
  console.log(`Transaction submitted: ${await tx.getTxHash()}\nWaiting for receipt...`);
  const receipt = await tx.wait();
  console.log('Transfer status:', receipt.status);
  if (receipt.status !== TxStatus.SUCCESS) {
    throw new Error('Transfer failed');
  }
  if (receipt.blockNumber === undefined) {
    throw new Error('No block number in receipt');
  }

  return receipt.blockNumber;
}

export function registerAztecTransferPrivate(program: Command) {
  return program
    .command('aztec-transfer-private')
    .description('Transfer Aztec tokens privately')
    .option('--token <symbol>', 'Token symbol', 'TT1')
    .option('--amount <amount>', 'Amount to transfer', '100')
    .requiredOption('--recipient <address>', 'Recipient address (required)')
    .action(async (options, command) => {
      // Get global and local options together
      const allOptions = command.optsWithGlobals();
      if (!allOptions.configDir) {
        throw new Error('Config directory is required. Use -c or --config-dir option.');
      }

      // Load configuration from files
      const configDir = allOptions.configDir;
      const configPaths = await getConfigPaths(configDir);
      const config = await loadDeployConfig(configPaths.configFile);

      // Use the deployment data from config directory
      const factory = await TurnstileFactory.fromConfig(configPaths.deploymentFile);

      // Get token and recipient from command options
      const tokenSymbol = options.token;
      const tokenInfo = factory.getTokenInfo(tokenSymbol);
      const tokenAddr = AztecAddress.fromString(tokenInfo.l2Address);

      const aztecTestAccounts = await getInitialTestAccounts();

      function recipientError(msg: string): Error {
        console.log(msg);
        console.log('Please use one of the following test addresses:');
        for (const acct of aztecTestAccounts) {
          console.log(`  ${acct.address.toString()}`);
        }
        return new Error(msg);
      }

      const recipient = AztecAddress.fromString(options.recipient);
      const recipientAccount = aztecTestAccounts.find((acc) => acc.address.equals(recipient));
      if (!recipientAccount) {
        throw recipientError('Recipient account not found');
      }

      const keyData = await readKeyData(configPaths.keysFile);
      const senderClient = await createL2Client({ node: config.connection.aztec.node }, keyData);
      const amount = BigInt(options.amount);

      // Ensure L2Portal & ShieldGateway are registered in the sender's PXE
      await factory.createL2Portal(senderClient);

      // Ensure L2 Token is registered in the PXE & get sender's token instance
      const senderToken = await factory.createL2Token(senderClient, tokenInfo);

      const recipientKeyData = {
        l2SigningKey: recipientAccount.signingKey.toString(),
        l2SecretKey: recipientAccount.secret.toString(),
        l2Salt: recipientAccount.salt.toString(),
      };

      const recipientClient = await createL2Client({ node: config.connection.aztec.node }, recipientKeyData);
      if (!recipientClient.getAddress().equals(recipient)) {
        throw new Error(
          `Recipient client address does not match recipient address. Got ${recipientClient.getAddress().toString()}, expected ${recipient.toString()}`,
        );
      }
      // Register the sender in the recipient's PXE
      console.log(`Registering Sender in RECIPIENT PXE: ${senderClient.getAddress().toString()}`);
      await recipientClient.getWallet().registerSender(senderClient.getAddress());
      console.log(`Registering Token in RECIPIENT PXE: ${tokenAddr.toString()}`);
      const recipientToken = await factory.createL2Token(recipientClient, tokenInfo);

      const initialRecipientBalance = await recipientToken
        .balanceOfPrivate(recipient)
        .simulate({ from: recipientClient.getAddress() });
      console.log(`Initial recipient balance (${recipient}): ${initialRecipientBalance}`);

      const initialSenderBalance = await senderToken
        .balanceOfPrivate(senderClient.getAddress())
        .simulate({ from: senderClient.getAddress() });
      console.log(`Initial sender balance (${senderClient.getAddress()}): ${initialSenderBalance}`);

      const balance = await senderToken
        .balanceOfPrivate(senderClient.getAddress())
        .simulate({ from: senderClient.getAddress() });
      if (balance < amount) {
        throw new Error('Insufficient balance');
      }

      await doTransfer(senderClient, senderToken, recipient, amount);

      const endingRecipientBalance = await recipientToken
        .balanceOfPrivate(recipient)
        .simulate({ from: recipientClient.getAddress() });
      console.log(`Final recipient balance (${recipient}): ${endingRecipientBalance}`);
      const endingSenderBalance = await senderToken
        .balanceOfPrivate(senderClient.getAddress())
        .simulate({ from: senderClient.getAddress() });
      console.log(`Final sender balance (${senderClient.getAddress()}): ${endingSenderBalance}`);
    });
}
