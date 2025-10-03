import { randomBytes } from 'node:crypto';
import { getConfigPaths, loadDeployConfig } from '@turnstile-portal/deploy';
import { InsecureMintableTokenABI, InsecureMintableTokenBytecode } from '@turnstile-portal/l1-artifacts-dev';
import { type Hex, L1AllowList, type L1Client, L1Portal, TurnstileFactory } from '@turnstile-portal/turnstile.js';
import { getChain, getClients, waitForL2Block } from '@turnstile-portal/turnstile-dev';
import type { Command } from 'commander';
import { type Address, getAddress, getContract, http } from 'viem';

// Helper functions for token deployment and registration
async function deployL1DevToken(client: L1Client, name: string, symbol: string, decimals: number): Promise<Hex> {
  console.log(`Deploying L1 Token ${name} (${symbol})...`);
  const walletClient = client.getWalletClient();
  const account = walletClient.account;
  if (!account) {
    throw new Error('No account connected to wallet client');
  }

  const txHash = await walletClient.deployContract({
    abi: InsecureMintableTokenABI,
    bytecode: InsecureMintableTokenBytecode,
    args: [name, symbol, decimals],
    account,
    chain: walletClient.chain,
  });

  const receipt = await client.getPublicClient().waitForTransactionReceipt({
    hash: txHash,
  });
  if (receipt.status !== 'success') {
    throw new Error(`Deploy failed: ${receipt}`);
  }

  const contractAddress = receipt.contractAddress;
  if (!contractAddress) {
    throw new Error(`Contract address not found in receipt: ${receipt}`);
  }

  console.log(`InsecureMintableToken deployed at ${contractAddress}`);
  await fundL1DevToken(client, contractAddress, BigInt(1000e18));
  return contractAddress;
}

async function fundL1DevToken(client: L1Client, tokenAddr: Hex, amount: bigint) {
  const walletClient = client.getWalletClient();
  const publicClient = client.getPublicClient();
  const account = walletClient.account;

  if (!account) {
    throw new Error('No account available on wallet');
  }

  const tokenContract = await getContract({
    address: tokenAddr,
    abi: InsecureMintableTokenABI,
    client: {
      public: publicClient,
      wallet: walletClient,
    },
  });

  const walletAddress = account.address;

  const mintHash = await tokenContract.write.mint([walletAddress, amount], {
    account,
    chain: walletClient.chain,
  });
  const mintReceipt = await publicClient.waitForTransactionReceipt({
    hash: mintHash,
  });
  if (mintReceipt.status !== 'success') {
    throw new Error(`Mint failed: ${mintReceipt}`);
  }
  console.log(`Minted ${amount} tokens for ${walletAddress}`);
}

async function proposeL1DevToken(client: L1Client, tokenAddr: Address, l1AllowList: Address) {
  console.log(`Proposing token ${tokenAddr} to L1 allowlist ${l1AllowList}`);
  const allowList = new L1AllowList(l1AllowList, client);
  const proposeReceipt = await allowList.propose(tokenAddr);
  if (proposeReceipt.status !== 'success') {
    throw new Error(`propose() failed: ${proposeReceipt}`);
  }
  console.log(`Proposed token in tx ${proposeReceipt.transactionHash}`);
}

async function acceptL1DevToken(client: L1Client, tokenAddr: Address, l1AllowList: Address) {
  const allowList = new L1AllowList(l1AllowList, client);
  const acceptReceipt = await allowList.accept(tokenAddr, client);
  if (acceptReceipt.status !== 'success') {
    throw new Error(`accept() failed: ${acceptReceipt}`);
  }
  console.log(`Accepted proposal in tx ${acceptReceipt.transactionHash}`);
}

async function registerL1DevToken(client: L1Client, tokenAddr: Address, l1PortalAddr: Address) {
  console.log(`Registering token ${tokenAddr} with L1 Portal ${l1PortalAddr}`);
  const l1Portal = new L1Portal(l1PortalAddr, client);
  const { txHash, messageHash, messageIndex, l2BlockNumber } = await l1Portal.register(tokenAddr);
  console.log(`L1 registration tx: ${txHash}, messageHash: ${messageHash}, messageIndex: ${messageIndex}`);
  return { txHash, messageHash, messageIndex, l2BlockNumber };
}

export function registerDeployAndRegisterToken(program: Command) {
  return program
    .command('deploy-and-register-token')
    .description('Deploy a token on L1 and register it with the Turnstile Portal on L1 & L2')
    .action(async (_options, command) => {
      console.log('Starting token deployment and registration...');

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
      const deploymentData = factory.getDeploymentData();
      const { l1Client, l2Client } = await getClients(
        { node: config.connection.aztec.node },
        {
          chain: getChain(config.connection.ethereum.chainName),
          transport: http(config.connection.ethereum.rpc),
        },
        configPaths.keysFile,
      );

      // Configure token details
      const suffix = randomBytes(4).toString('hex');
      const tokenName = `TestToken${suffix}`;
      const tokenSymbol = `TT${suffix}`;
      const tokenDecimals = 18;

      console.log(`Deploying token: ${tokenName} (${tokenSymbol})`);
      console.log('--------------------------------------------------');

      try {
        // Step 1: Deploy L1 Token
        console.log(`1. Deploying L1 Token ${tokenName} (${tokenSymbol})...`);
        const l1TokenAddr = await deployL1DevToken(l1Client, tokenName, tokenSymbol, tokenDecimals);
        console.log(`✅ L1 token deployed at: ${l1TokenAddr}`);

        // Step 2: Propose token to allowlist
        console.log('2. Proposing token to L1 allowlist...');
        const l1AllowListAddr = getAddress(deploymentData.l1AllowList);
        await proposeL1DevToken(l1Client, l1TokenAddr, l1AllowListAddr);
        console.log('✅ Token proposed to allowlist');

        // Step 3: Accept token proposal (in dev environment, same account can do this)
        console.log('3. Accepting token proposal...');
        await acceptL1DevToken(l1Client, l1TokenAddr, l1AllowListAddr);
        console.log('✅ Token accepted on allowlist');

        // Step 4: Register token with L1 Portal
        console.log('4. Registering token with L1 Portal...');
        const l1PortalAddr = getAddress(deploymentData.l1Portal);
        const { txHash, messageHash, messageIndex, l2BlockNumber } = await registerL1DevToken(
          l1Client,
          l1TokenAddr,
          l1PortalAddr,
        );
        console.log('✅ L1 registration complete:');
        console.log(`   - TX: ${txHash}`);
        console.log(`   - Message Hash: ${messageHash}`);
        console.log(`   - Message Index: ${messageIndex}`);
        console.log(`   - L2 Block Number: ${l2BlockNumber}`);

        // Step 5: Deploy & Register L2 Token
        console.log('5. Deploying & Registering L2 Token...');

        // Wait for L2 block to be mined
        await waitForL2Block(l2Client, l2BlockNumber);

        // Create L2Portal instance & ensure it's registered in PXE
        const aztecPortal = await factory.createL2Portal(l2Client, l1Client);

        const l2TokenAddr = await aztecPortal.deployAndRegisterL2Token(
          l1TokenAddr,
          tokenName,
          tokenSymbol,
          tokenDecimals,
          messageIndex,
          { from: l2Client.getAddress(), fee: l2Client.getFeeOpts() },
        );

        console.log(`✅ L2 token deployed and registered at: ${l2TokenAddr}`);
        console.log('✅ L2 registration complete');

        console.log('--------------------------------------------------');
        console.log(`🎉 Token ${tokenSymbol} successfully deployed and registered!`);
        console.log(`📍 L1 Address: ${l1TokenAddr}`);
        console.log(`📍 L2 Address: ${l2TokenAddr}`);
        console.log('--------------------------------------------------');
      } catch (error) {
        console.error('❌ Error during token deployment:', error);
        throw error;
      }
    });
}
