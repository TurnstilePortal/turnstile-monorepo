import { getInitialTestAccounts } from '@aztec/accounts/testing';
import {
  AztecAddress,
  createAztecNodeClient,
  Fr,
  TxStatus,
} from '@aztec/aztec.js';
import {
  type L2Client,
  L2Token,
  registerShieldGatewayInPXE,
  TurnstileFactory,
} from '@turnstile-portal/turnstile.js';
import {
  createL2Client,
  createPXE,
  readKeyData,
} from '@turnstile-portal/turnstile-dev';
import type { Command } from 'commander';

async function doTransfer(
  l2Client: L2Client,
  tokenAddr: AztecAddress,
  recipient: AztecAddress,
  amount: bigint,
): Promise<number> {
  const token = await L2Token.fromAddress(tokenAddr, l2Client);

  const symbol = await token.getSymbol();
  console.log(`PRIVATELY Transferring ${amount} ${symbol} to ${recipient}...`);

  const balance = await token.balanceOfPrivate(l2Client.getAddress());
  if (balance < amount) {
    throw new Error('Insufficient balance');
  }

  // TODO: Use a correctly formatted verified ID
  const verifiedID: Fr[] & { length: 5 } = [
    Fr.fromHexString('0x01'),
    Fr.fromHexString('0x02'),
    Fr.fromHexString('0x03'),
    Fr.fromHexString('0x04'),
    Fr.fromHexString('0x05'),
  ];
  console.log('Using Verified ID:', verifiedID);

  const tx = await token.transferPrivate(recipient, amount, verifiedID);
  console.log(
    `Transaction submitted: ${await tx.getTxHash()}\nWaiting for receipt...`,
  );
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

      // Get token and recipient from command options
      const tokenSymbol = options.token;
      const tokenInfo = factory.getTokenInfo(tokenSymbol);
      const tokenAddr = AztecAddress.fromString(tokenInfo.l2Address);

      const node = createAztecNodeClient(config.connection.aztec.node);
      const _pxe = await createPXE(node);
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
      const recipientAccount = aztecTestAccounts.find((acc) =>
        acc.address.equals(recipient),
      );
      if (!recipientAccount) {
        throw recipientError('Recipient account not found');
      }

      const keyData = await readKeyData(configPaths.keysFile);
      const senderClient = await createL2Client(
        { node: config.connection.aztec.node },
        keyData,
      );
      const amount = BigInt(options.amount);

      // Ensure L2 Token is registered in the PXE
      console.log(`Registering Token in SENDER PXE: ${tokenAddr.toString()}`);
      await L2Token.register(
        senderClient,
        tokenAddr,
        AztecAddress.fromString(factory.getDeploymentData().aztecPortal),
        tokenInfo.name,
        tokenInfo.symbol,
        tokenInfo.decimals,
      );
      const shieldGatewayAddr = AztecAddress.fromString(
        factory.getDeploymentData().aztecShieldGateway,
      );
      console.log(
        `Registering ShieldGateway in SENDER PXE: ${shieldGatewayAddr.toString()}`,
      );
      await registerShieldGatewayInPXE(senderClient, shieldGatewayAddr);

      const recipientKeyData = {
        l2SigningKey: recipientAccount.signingKey.toString(),
        l2SecretKey: recipientAccount.secret.toString(),
        l2Salt: recipientAccount.salt.toString(),
      };

      const recipientClient = await createL2Client(
        { node: config.connection.aztec.node },
        recipientKeyData,
      );
      if (!recipientClient.getAddress().equals(recipient)) {
        throw new Error(
          `Recipient client address does not match recipient address. Got ${recipientClient.getAddress().toString()}, expected ${recipient.toString()}`,
        );
      }
      // Register the sender in the recipient's PXE
      console.log(
        `Registering Sender in RECIPIENT PXE: ${senderClient.getAddress().toString()}`,
      );
      await recipientClient
        .getWallet()
        .registerSender(senderClient.getAddress());
      console.log(
        `Registering Token in RECIPIENT PXE: ${tokenAddr.toString()}`,
      );
      await L2Token.register(
        recipientClient,
        tokenAddr,
        AztecAddress.fromString(factory.getDeploymentData().aztecPortal),
        tokenInfo.name,
        tokenInfo.symbol,
        tokenInfo.decimals,
      );

      const initialRecipientBalance = await (
        await L2Token.fromAddress(tokenAddr, recipientClient)
      ).balanceOfPrivate(recipient);
      console.log(
        `Initial recipient balance (${recipient}): ${initialRecipientBalance}`,
      );

      const initialSenderBalance = await (
        await L2Token.fromAddress(tokenAddr, senderClient)
      ).balanceOfPrivate(senderClient.getAddress());
      console.log(
        `Initial sender balance (${senderClient.getAddress()}): ${initialSenderBalance}`,
      );

      await doTransfer(senderClient, tokenAddr, recipient, amount);

      const endingRecipientBalance = await (
        await L2Token.fromAddress(tokenAddr, recipientClient)
      ).balanceOfPrivate(recipient);
      console.log(
        `Final recipient balance (${recipient}): ${endingRecipientBalance}`,
      );

      const endingSenderBalance = await (
        await L2Token.fromAddress(tokenAddr, senderClient)
      ).balanceOfPrivate(senderClient.getAddress());
      console.log(
        `Final sender balance (${senderClient.getAddress()}): ${endingSenderBalance}`,
      );
    });
}
