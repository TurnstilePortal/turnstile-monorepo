import { EthAddress, Fr, TxStatus } from '@aztec/aztec.js';
import { getConfigPaths, loadDeployConfig } from '@turnstile-portal/deploy';
import {
  ContractBatchBuilder,
  type IL2Client,
  type L1Client,
  L1Portal,
  TurnstileFactory,
} from '@turnstile-portal/turnstile.js';
import { getChain, getClients, InsecureMintableToken, waitForL2Block } from '@turnstile-portal/turnstile-dev';
import type { Command } from 'commander';
import type { Address } from 'viem';
import { getAddress, http } from 'viem';

interface DepositInfo {
  tokenSymbol: string;
  tokenAddr: Address;
  amount: bigint;
  messageHash: string;
  messageIndex: number;
  l2BlockNumber: number;
}

/**
 * Deposits multiple tokens from L1 to L2 in separate transactions
 * Returns info needed to claim each deposit on L2
 */
async function depositMultipleTokens({
  l1PortalAddr,
  tokens,
  l2RecipientAddr,
  l1Client,
}: {
  l1PortalAddr: Address;
  tokens: Array<{ symbol: string; addr: Address; amount: bigint }>;
  l2RecipientAddr: string;
  l1Client: L1Client;
}): Promise<DepositInfo[]> {
  const portal = new L1Portal(l1PortalAddr, l1Client);
  const deposits: DepositInfo[] = [];

  for (const { symbol, addr, amount } of tokens) {
    console.log(`\n--- Depositing ${symbol} ---`);

    const tokenClient = new InsecureMintableToken(addr, l1Client);

    // Mint tokens (for testing)
    console.log(`Minting ${amount} ${symbol} tokens...`);
    await tokenClient.mint(addr, l1Client.getAddress(), amount);

    // Approve the Portal to spend tokens
    console.log(`Approving Portal to spend ${symbol} tokens...`);
    await tokenClient.approve(l1PortalAddr, amount);

    // Deposit the tokens
    console.log(`Depositing ${amount} ${symbol} to L2...`);
    const result = await portal.deposit(addr, l2RecipientAddr, amount);

    // Wait for confirmation
    const receipt = await l1Client.getPublicClient().waitForTransactionReceipt({
      hash: result.txHash,
    });

    if (receipt.status !== 'success') {
      throw new Error(`Deposit of ${symbol} failed: ${receipt}`);
    }

    console.log(`${symbol} deposit successful. Tx: ${result.txHash}`);
    console.log(`Message index: ${result.messageIndex}, L2 block: ${result.l2BlockNumber}`);

    deposits.push({
      tokenSymbol: symbol,
      tokenAddr: addr,
      amount,
      messageHash: result.messageHash,
      messageIndex: Number(result.messageIndex),
      l2BlockNumber: Number(result.l2BlockNumber),
    });
  }

  return deposits;
}

/**
 * Claims multiple deposited tokens on L2 in a single batch transaction
 * This demonstrates the optimization of claiming N tokens in 1 transaction instead of N
 */
async function batchClaimDeposits({
  deposits,
  factory,
  l2Client,
}: {
  deposits: DepositInfo[];
  factory: TurnstileFactory;
  l2Client: IL2Client;
}) {
  console.log(`\n=== Batch claiming ${deposits.length} token deposits ===`);

  // Get the L2 Portal instance
  const l2Portal = await factory.createL2Portal(l2Client);
  const portal = await l2Portal.getInstance();

  // Create batch builder
  const batch = new ContractBatchBuilder(l2Client.getWallet());

  // Add all claim interactions to the batch
  for (const deposit of deposits) {
    console.log(`Adding ${deposit.tokenSymbol} claim to batch...`);

    // Ensure the L2 token is registered
    await factory.createL2Token(l2Client, factory.getTokenInfo(deposit.tokenSymbol));

    // Create claim interaction (doesn't execute yet)
    const claimInteraction = portal.methods.claim_public(
      EthAddress.fromString(deposit.tokenAddr),
      l2Client.getAddress(), // Use L2 address format
      deposit.amount,
      Fr.fromHexString(`0x${deposit.messageIndex.toString(16)}`),
    );

    batch.add(claimInteraction);
  }

  // Execute the batch claim
  console.log(`\nExecuting batch claim of ${deposits.length} tokens in a single transaction...`);
  const batchTx = batch.send({
    from: l2Client.getAddress(),
    fee: l2Client.getFeeOpts(),
  });

  console.log(`Batch claim transaction submitted: ${await batchTx.getTxHash()}`);
  const receipt = await batchTx.wait();

  if (receipt.status !== TxStatus.SUCCESS) {
    throw new Error(`Batch claim failed: ${receipt.status}`);
  }

  console.log(`✅ Successfully claimed ${deposits.length} tokens in a single transaction!`);
  console.log(`Transaction hash: ${receipt.txHash}`);

  // Display claimed balances
  console.log('\n--- Claimed Token Balances ---');
  for (const deposit of deposits) {
    const tokenInfo = factory.getTokenInfo(deposit.tokenSymbol);
    const l2Token = await factory.createL2Token(l2Client, tokenInfo);
    const balance = await l2Token.balanceOfPublic(l2Client.getAddress());
    console.log(`${deposit.tokenSymbol}: ${balance}`);
  }
}

export function registerBatchClaimDeposits(program: Command) {
  return program
    .command('batch-claim-deposits')
    .description('Deposit multiple tokens from L1 and claim them all on L2 in a single batch transaction')
    .option('--tokens <symbols>', 'Comma-separated token symbols', 'TT1,TT2,TT3')
    .option('--amounts <amounts>', 'Comma-separated amounts', '1000000000,2000000000,3000000000')
    .option('--l2-recipient <address>', 'L2 Recipient Address')
    .action(async (options, command) => {
      // Get global and local options
      const allOptions = command.optsWithGlobals();
      if (!allOptions.configDir) {
        throw new Error('Config directory is required. Use -c or --config-dir option.');
      }

      // Parse token symbols and amounts
      const tokenSymbols = options.tokens.split(',');
      const amounts = options.amounts.split(',').map((a: string) => BigInt(a));

      if (tokenSymbols.length !== amounts.length) {
        throw new Error('Number of tokens must match number of amounts');
      }

      // Load configuration
      const configDir = allOptions.configDir;
      const configPaths = getConfigPaths(configDir);
      const config = await loadDeployConfig(configPaths.configFile);

      // Load factory with deployment data
      const factory = await TurnstileFactory.fromConfig(configPaths.deploymentFile);
      const deploymentData = factory.getDeploymentData();

      // Get clients
      const { l1Client, l2Client } = await getClients(
        { node: config.connection.aztec.node },
        {
          chain: getChain(config.connection.ethereum.chainName),
          transport: http(config.connection.ethereum.rpc),
        },
        configPaths.keysFile,
      );

      const l2Recipient = options.l2Recipient ? options.l2Recipient : l2Client.getAddress().toString();

      // Prepare token deposit info
      const tokensToDeposit = tokenSymbols.map((symbol: string, index: number) => {
        const tokenInfo = factory.getTokenInfo(symbol);
        return {
          symbol,
          addr: getAddress(tokenInfo.l1Address) as Address,
          amount: amounts[index],
        };
      });

      console.log('=== Depositing Multiple Tokens from L1 ===');
      console.log(`Tokens: ${tokenSymbols.join(', ')}`);
      console.log(`L2 Recipient: ${l2Recipient}`);

      // Step 1: Deposit all tokens on L1 (these can't be batched on L1)
      const deposits = await depositMultipleTokens({
        l1PortalAddr: getAddress(deploymentData.l1Portal),
        tokens: tokensToDeposit,
        l2RecipientAddr: l2Recipient,
        l1Client,
      });

      // Step 2: Wait for the highest L2 block number
      const maxL2Block = Math.max(...deposits.map((d) => d.l2BlockNumber));
      console.log(`\nWaiting for L2 block ${maxL2Block} to be mined...`);
      await waitForL2Block(l2Client, maxL2Block);

      // Step 3: Batch claim all deposits on L2 in a single transaction
      await batchClaimDeposits({
        deposits,
        factory,
        l2Client,
      });

      console.log('\n🎉 Batch deposit and claim complete!');
      console.log(`Deposited ${tokenSymbols.length} tokens from L1 in ${tokenSymbols.length} transactions`);
      console.log(`Claimed all ${tokenSymbols.length} tokens on L2 in 1 batched transaction`);
      console.log(`Optimization: Reduced L2 transactions from ${tokenSymbols.length} to 1`);
    });
}
