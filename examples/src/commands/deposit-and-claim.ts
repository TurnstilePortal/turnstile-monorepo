import { TxStatus } from '@aztec/aztec.js';
import { getConfigPaths, loadDeployConfig } from '@turnstile-portal/deploy';
import {
  type L1Client,
  L1Portal,
  TurnstileFactory,
} from '@turnstile-portal/turnstile.js';
import {
  getChain,
  getClients,
  InsecureMintableToken,
  waitForL2Block,
} from '@turnstile-portal/turnstile-dev';
import type { Command } from 'commander';
import type { Address } from 'viem';
import { getAddress, http } from 'viem';

async function l1MintAndDeposit({
  l1PortalAddr,
  tokenAddr,
  l2RecipientAddr,
  amount,
  l1Client,
}: {
  l1PortalAddr: Address;
  tokenAddr: Address;
  l2RecipientAddr: string;
  amount: bigint;
  l1Client: L1Client;
}): Promise<{ hash: string; l2BlockNumber: number; index: number }> {
  const tokenClient = new InsecureMintableToken(tokenAddr, l1Client);

  // Mint tokens to the wallet holder
  // Minting is for testing only
  await tokenClient.mint(tokenAddr, l1Client.getAddress(), amount);

  // Approve the Token Portal to spend the tokens. Required before depositing.
  await tokenClient.approve(l1PortalAddr, amount);

  // Deposit the tokens to the L2 network
  const portal = new L1Portal(l1PortalAddr, l1Client);

  // Call deposit with the required parameters
  const result = await portal.deposit(tokenAddr, l2RecipientAddr, amount);

  // Wait for confirmation
  console.log('L1 Deposit initiated. Waiting for confirmation...');
  const receipt = await l1Client.getPublicClient().waitForTransactionReceipt({
    hash: result.txHash,
  });

  if (receipt.status !== 'success') {
    throw new Error(`deposit() failed: ${receipt}`);
  }

  console.log(`L1 Deposit successful. Transaction hash: ${result.txHash}`);
  console.log(
    `Message hash: ${result.messageHash}, Message index: ${result.messageIndex}`,
  );

  const { l2BlockNumber } = result;

  console.log(
    `Estimated L2 Block Number: ${l2BlockNumber}, Message Index: ${result.messageIndex}`,
  );

  return {
    hash: result.messageHash,
    l2BlockNumber: Number(l2BlockNumber),
    index: Number(result.messageIndex),
  };
}

export function registerDepositAndClaim(program: Command) {
  return program
    .command('deposit-and-claim')
    .description('Deposit tokens from L1 to L2 and claim them')
    .option('--token <symbol>', 'Token symbol', 'TT1')
    .option('--amount <amount>', 'Amount to deposit', '1000000000')
    .option('--l2-recipient <address>', 'L2 Recipient Address')
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
      const configPaths = getConfigPaths(configDir);
      const config = await loadDeployConfig(configPaths.configFile);

      // Use the deployment data from config directory
      const factory = await TurnstileFactory.fromConfig(
        configPaths.deploymentFile,
      );

      // Get token from command option
      const tokenSymbol = options.token;
      const tokenInfo = factory.getTokenInfo(tokenSymbol);
      const l1TokenAddr = tokenInfo.l1Address;

      const { l1Client, l2Client } = await getClients(
        { node: config.connection.aztec.node },
        {
          chain: getChain(config.connection.ethereum.chainName),
          transport: http(config.connection.ethereum.rpc),
        },
        configPaths.keysFile,
      );

      // Get amount from command option
      const amount = BigInt(options.amount);

      const l2Recipient = options.l2Recipient
        ? options.l2Recipient
        : l2Client.getAddress().toString();

      const deploymentData = factory.getDeploymentData();
      const { index, l2BlockNumber } = await l1MintAndDeposit({
        l1PortalAddr: getAddress(deploymentData.l1Portal),
        tokenAddr: getAddress(l1TokenAddr),
        l2RecipientAddr: l2Recipient,
        amount,
        l1Client,
      });

      // We need to wait for the L2 block to be mined so that the L1ToL2Message is available on the L2 chain.
      // In a real scenario, we would wait for the L2 blocks to be mined naturally, but for testing purposes
      // we will advance the blocks ourselves.
      await waitForL2Block(l2Client, l2BlockNumber);

      // Create L2 Portal instance & ensure it's registered in the PXE
      const aztecPortal = await factory.createL2Portal(l2Client);

      // Ensure L2 Token is registered in the PXE
      await factory.createL2Token(l2Client, factory.getTokenInfo(tokenSymbol));

      const tx = await aztecPortal.claimDeposit(
        l1TokenAddr,
        l2Recipient,
        amount,
        BigInt(index),
      );
      console.log(
        `Claim transaction hash: ${await tx.getTxHash()}\nWaiting for receipt...`,
      );
      const receipt = await tx.wait();
      if (receipt.status !== TxStatus.SUCCESS) {
        throw new Error(`claimDeposit() failed. status: ${receipt.status}`);
      }
      console.log(`Deposit and claim for token ${tokenSymbol} complete`);
    });
}
