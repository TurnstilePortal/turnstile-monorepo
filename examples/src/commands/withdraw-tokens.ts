import { TxStatus } from '@aztec/aztec.js';
import type { L2ToL1MembershipWitness } from '@aztec/stdlib/messaging';
import { getConfigPaths, loadDeployConfig } from '@turnstile-portal/deploy';
import {
  type Hex,
  type IL1Client,
  type IL2Client,
  L1Portal,
  L1Token,
  type L2Portal,
  type L2Token,
  TurnstileFactory,
} from '@turnstile-portal/turnstile.js';
import { getChain, getClients, setAssumeProven } from '@turnstile-portal/turnstile-dev';
import type { Command } from 'commander';
import { getAddress, http } from 'viem';

async function initiateL2Withdrawal({
  l2Client,
  l2Token,
  l2Portal,
  l1TokenAddr,
  l1Recipient,
  amount,
}: {
  l2Client: IL2Client;
  l2Token: L2Token;
  l2Portal: L2Portal;
  l1Recipient: Hex;
  l1TokenAddr: Hex;
  amount: bigint;
}) {
  const symbol = await l2Token.getSymbol();
  console.log(`Initiating withdrawal of ${amount} ${symbol} to L1 recipient ${l1Recipient}`);

  console.log('Current L2 balance:', await l2Token.balanceOfPublic(l2Client.getAddress()));

  // Create burn action
  const { action, nonce } = await l2Token.createPublicBurnAuthwitAction(l2Client.getAddress(), amount);

  console.log('Setting up burn authorization...');
  const burnAuthTx = await action.send({
    fee: l2Client.getFeeOpts(),
    from: l2Client.getAddress(),
  });

  console.log(`Waiting for burn authorization transaction ${await burnAuthTx.getTxHash()}...`);
  const burnAuthReceipt = await burnAuthTx.wait();
  console.log(`Burn authorization sent. Status: ${burnAuthReceipt.status.toString()}`);

  // Initiate the withdrawal from the Portal
  const { tx: withdrawTx, withdrawData } = await l2Portal.withdrawPublic(l1TokenAddr, l1Recipient, amount, nonce, {
    fee: l2Client.getFeeOpts(),
    from: l2Client.getAddress(),
  });

  console.log(`Withdrawal initiated on L2. Tx: ${(await withdrawTx.getTxHash()).toString()}`);

  const receipt = await withdrawTx.wait();
  if (receipt.status !== TxStatus.SUCCESS) {
    throw new Error('Withdrawal failed');
  }
  const l2BlockNumber = receipt.blockNumber;
  if (!l2BlockNumber) {
    throw new Error('Failed to get block number');
  }

  const l1ContractAddresses = await l2Client.getNode().getL1ContractAddresses();
  const outboxVersion = await l2Portal.getAztecL1OutboxVersion(l1ContractAddresses.outboxAddress);
  const message = await l2Portal.computeL2ToL1Message(l1TokenAddr, l1Recipient, amount, outboxVersion);
  const witness = await l2Portal.getL2ToL1MembershipWitness(l2BlockNumber, message);

  console.log('New L2 balance:', await l2Token.balanceOfPublic(l2Client.getAddress()));

  return { l2BlockNumber, witness, message, withdrawData };
}

async function completeL1Withdrawal({
  l1Client,
  l1TokenAddr,
  l1Portal,
  withdrawData,
  l2BlockNumber,
  witness,
}: {
  l1Client: IL1Client;
  l1TokenAddr: Hex;
  l1Portal: L1Portal;
  withdrawData: Hex;
  l2BlockNumber: number;
  witness: L2ToL1MembershipWitness;
}) {
  console.log('Waiting for L2 block to be available on L1...');
  await l1Portal.waitForBlockOnL1(
    l2BlockNumber,
    60, // Timeout in seconds
  );

  const { siblingPath, leafIndex } = witness;

  const l1Token = new L1Token(l1TokenAddr, l1Client);
  console.log(`Current L1 balance: ${await l1Token.balanceOf(l1Client.getAddress())}`);

  const tx = await l1Portal.withdraw(withdrawData, l2BlockNumber, leafIndex, siblingPath);
  console.log(`L1 Withdraw transaction hash: ${tx}`);

  const receipt = await l1Client.getPublicClient().waitForTransactionReceipt({ hash: tx });

  if (receipt.status !== 'success') {
    console.log('L1 Withdraw transaction receipt:', receipt);
    throw new Error(`L1 Withdraw transaction failed: ${receipt.status}`);
  }
  console.log('L1 Withdrawal complete');
  console.log(`New L1 balance: ${await l1Token.balanceOf(l1Client.getAddress())}`);
}

export function registerWithdrawTokens(program: Command) {
  return program
    .command('withdraw-tokens')
    .description('Withdraw tokens from L2 to L1')
    .option('--token <symbol>', 'Token symbol', 'TT1')
    .option('--amount <amount>', 'Amount to withdraw', '1000')
    .option('--l1-recipient <address>', 'L1 Recipient Address')
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

      // Get token from command option
      const tokenSymbol = options.token;
      const tokenInfo = factory.getTokenInfo(tokenSymbol);
      const deploymentData = factory.getDeploymentData();
      const l1TokenAddr = getAddress(tokenInfo.l1Address) as `0x${string}`;

      const { l1Client, l2Client } = await getClients(
        { node: config.connection.aztec.node },
        {
          chain: getChain(config.connection.ethereum.chainName),
          transport: http(config.connection.ethereum.rpc),
        },
        configPaths.keysFile,
      );

      const l1Recipient = options.l1Recipient ? getAddress(options.l1Recipient) : l1Client.getAddress();
      const amount = BigInt(options.amount);

      // Create L2 Portal & ensure it is registered in the PXE
      const l2Portal = await factory.createL2Portal(l2Client, l1Client);
      // Create L2 Token & ensure it is registered in the PXE
      const l2Token = await factory.createL2Token(l2Client, tokenInfo);

      console.log(`Withdrawing ${amount} ${tokenSymbol} from L2 to L1 recipient ${l1Recipient}`);

      const { l2BlockNumber, witness, withdrawData } = await initiateL2Withdrawal({
        l2Client,
        l2Portal,
        l2Token,
        l1TokenAddr,
        l1Recipient,
        amount,
      });

      // Wait for the L2 block to be available on the L1 chain
      const l1Portal = new L1Portal(getAddress(deploymentData.l1Portal), l1Client);

      // Cheat to make the L2 block available on L1
      // Note: rollupAddress will be obtained automatically by L1Portal
      await setAssumeProven(config.connection.ethereum.rpc, await l1Portal.getRollupAddress(), l2BlockNumber);
      console.log(`Waiting for L2 block ${l2BlockNumber} to be available on L1...`);
      await l1Portal.waitForBlockOnL1(l2BlockNumber, 60);

      // L2 block is available. Withdraw the tokens on L1 chain.
      await completeL1Withdrawal({
        l1Client,
        l1TokenAddr,
        l1Portal,
        withdrawData,
        l2BlockNumber,
        witness,
      });
    });
}
