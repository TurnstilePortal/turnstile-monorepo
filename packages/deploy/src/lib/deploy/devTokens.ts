import { AztecAddress, Fr, retryUntil, TxStatus } from '@aztec/aztec.js';
import { InsecureMintableTokenABI, InsecureMintableTokenBytecode } from '@turnstile-portal/l1-artifacts-dev';
import type { Hex, L1Client, L2Client } from '@turnstile-portal/turnstile.js';
import { L1AllowList, L1Portal, L2Portal, L2Token } from '@turnstile-portal/turnstile.js';
import { InsecureMintableToken, waitForL2Block } from '@turnstile-portal/turnstile-dev';
import { type Address, getContract } from 'viem';

const ADDITIONAL_L1_ADDRESSES_TO_FUND: `0x${string}`[] = [
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
  '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
  '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
  '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',
  '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f',
  '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720',
];

export async function deployL1DevToken(client: L1Client, name: string, symbol: string, decimals: number) {
  console.log(`Deploying L1 Token ${name} (${symbol})...`);
  // Deploy the token using the wallet client directly
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

  const tokenAddr = contractAddress;
  console.log(`InsecureMintableToken deployed at ${tokenAddr}`);
  await fundL1DevToken(client, tokenAddr, BigInt(1000e18));
  return tokenAddr;
}

export async function fundL1DevToken(client: L1Client, tokenAddr: Hex, amount: bigint) {
  const walletClient = client.getWalletClient();
  const publicClient = client.getPublicClient();
  const account = walletClient.account;

  if (!account) {
    throw new Error('No account available on wallet');
  }

  // Create contract instance for minting
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
  console.log(`InsecureMintableToken(${tokenAddr}) minted ${amount} for ${walletAddress}`);

  // Fund additional addresses
  for (const a of ADDITIONAL_L1_ADDRESSES_TO_FUND) {
    const additionalMintHash = await tokenContract.write.mint([a, amount], {
      account,
      chain: walletClient.chain,
    });
    const additionalMintReceipt = await publicClient.waitForTransactionReceipt({
      hash: additionalMintHash,
    });
    if (additionalMintReceipt.status !== 'success') {
      throw new Error(`Additional mint failed: ${additionalMintReceipt}`);
    }
    console.log(`InsecureMintableToken(${tokenAddr}) minted ${amount} for ${a}`);
  }
}

function getL1AllowList(client: L1Client, l1AllowList: Address) {
  return new L1AllowList(l1AllowList, client);
}

export async function proposeL1DevToken(client: L1Client, tokenAddr: Address, l1AllowList: Address) {
  console.log(`Proposing token ${tokenAddr} to L1 allowlist ${l1AllowList}`);

  const allowList = getL1AllowList(client, l1AllowList);

  // Propose the token to the allowlist
  const proposeReceipt = await allowList.propose(tokenAddr);
  if (proposeReceipt.status !== 'success') {
    throw new Error(`propose() failed: ${proposeReceipt}`);
  }
  console.log(`Proposed token to portal in tx ${proposeReceipt.transactionHash}`);
}

export async function acceptL1DevToken(client: L1Client, tokenAddr: Address, l1AllowList: Address) {
  // In a real scenario, the approver would be a different actor than the proposer and there
  // would be a process to approve the proposal.
  // For testing, we're using the same client as the approver
  const allowList = getL1AllowList(client, l1AllowList);

  const acceptReceipt = await allowList.accept(tokenAddr, client);
  if (acceptReceipt.status !== 'success') {
    throw new Error(`accept() failed: ${acceptReceipt}`);
  }
  console.log(`Accepted proposal in tx ${acceptReceipt.transactionHash}`);
}

export async function registerL1DevToken(client: L1Client, tokenAddr: Address, l1PortalAddr: Address) {
  console.log(`Registering token ${tokenAddr} with L1 Portal ${l1PortalAddr}`);
  const l1Portal = new L1Portal(l1PortalAddr, client);
  const { txHash, messageHash, messageIndex, l2BlockNumber } = await l1Portal.register(tokenAddr);
  console.log(`L1 registration tx: ${txHash}, messageHash: ${messageHash}, messageIndex: ${messageIndex}`);
  return { txHash, messageHash, messageIndex, l2BlockNumber };
}

/**
 * Registers a token on L2 with the Turnstile Portal
 *
 * @param l2Client The L2 client
 * @param aztecPortalAddr The Aztec Portal address on L2
 * @param l1TokenAddr The L1 token address
 * @param l2TokenAddr The L2 token address
 * @param name The token name
 * @param symbol The token symbol
 * @param decimals The token decimals
 * @param index The message index from L1 registration
 * @param l2BlockNumber The L2 block number where the L1->L2 message is included
 */
export async function registerL2DevToken(
  l2Client: L2Client,
  aztecPortalAddr: Hex,
  l1TokenAddr: Hex,
  l2TokenAddr: Hex,
  name: string,
  symbol: string,
  decimals: number,
  index: bigint,
  l2BlockNumber: number,
  msgHash: string,
): Promise<void> {
  console.log(`registerL2DevToken: Registering L2 token ${symbol} (${l2TokenAddr})...`);
  // In sandbox environment, we cheat to get to the desired block number.
  // For non-sandbox environment, we'd want to throw an error
  await waitForL2Block(l2Client, l2BlockNumber);

  const portal = new L2Portal(AztecAddress.fromString(aztecPortalAddr), l2Client);

  const l1ToL2Message = Fr.fromHexString(msgHash);

  // Wait for the L1 to L2 message to be be available
  console.log(`Waiting for L1 to L2 message ${l1ToL2Message.toString()} to be available...`);
  await retryUntil(
    async () => {
      console.log('Still waiting...');
      return await l2Client.getNode().isL1ToL2MessageSynced(l1ToL2Message);
    },
    'L1 to L2 message to be synced',
    30,
  );

  /*
  // Now wait for 2 more blocks, copying the technique from https://github.com/AztecProtocol/aztec-packages/pull/12386
  // that fixed https://github.com/AztecProtocol/aztec-packages/issues/12366
  const currentBlock = await l2Client.getNode().getBlockNumber();
  const targetBlock = currentBlock + 2;
  console.log(`Waiting for 2 more blocks to reach block ${targetBlock}...`);
  await waitForL2Block(l2Client, targetBlock);
  */

  // Now actually register the token
  const registerTokenTx = await portal.registerToken(l1TokenAddr, l2TokenAddr, name, symbol, decimals, index, {
    from: l2Client.getAddress(),
    fee: l2Client.getFeeOpts(),
  });

  console.log(`Transaction submitted: ${await registerTokenTx.getTxHash()}`);
  console.log('Waiting for receipt...');

  const aztecRegisterReceipt = await registerTokenTx.wait();
  if (aztecRegisterReceipt.status !== TxStatus.SUCCESS) {
    throw new Error(`registerToken() failed. status: ${aztecRegisterReceipt.status}`);
  }
  console.log(`Token ${symbol} registered with the Aztec Portal in tx ${aztecRegisterReceipt.txHash}`);
}

export async function deployL2DevToken(
  l2Client: L2Client,
  aztecPortal: AztecAddress,
  name: string,
  symbol: string,
  decimals: number,
): Promise<L2Token> {
  try {
    console.log(`Deploying L2 Token ${name} (${symbol})...`);
    const token = await L2Token.deploy(l2Client, aztecPortal, name, symbol, decimals, {
      from: l2Client.getAddress(),
      fee: l2Client.getFeeOpts(),
    });

    console.log(
      `L2 Token ${name} (${symbol}) partial address: ${(await token.getContract().partialAddress).toString()}`,
    );

    console.log(`TokenContract deployed at ${token.getAddress().toString()}`);
    return token;
  } catch (error) {
    console.error(`Error deploying L2 token: ${error}`);
    throw error;
  }
}

export async function bridgeL1ToL2DevToken(
  l1Client: L1Client,
  l2Client: L2Client,
  l1TokenAddr: Hex,
  l2TokenAddr: AztecAddress,
  l1PortalAddr: Hex,
  l2PortalAddr: AztecAddress,
  amount: bigint = BigInt(1000e18),
): Promise<void> {
  const l1TokenClient = new InsecureMintableToken(l1TokenAddr, l1Client);
  const symbol = await l1TokenClient.getSymbol();
  const recipient = l2Client.getAddress().toString();

  console.log(
    `Bridging ${amount} ${symbol} L1 addr ${l1TokenAddr} L2 addr ${l2TokenAddr.toString()} for ${recipient}...`,
  );

  await l1TokenClient.approve(l1PortalAddr, amount);

  const l1Portal = new L1Portal(l1PortalAddr, l1Client);
  const depositResult = await l1Portal.deposit(l1TokenAddr, recipient, amount);

  console.log(`L1 deposit tx submitted: ${depositResult.txHash}, messageHash: ${depositResult.messageHash}`);
  const receipt = await l1Client.getPublicClient().waitForTransactionReceipt({
    hash: depositResult.txHash,
  });
  if (receipt.status !== 'success') {
    throw new Error(`L1 deposit transaction failed: ${receipt}`);
  }

  await waitForL2Block(l2Client, Number(depositResult.l2BlockNumber));
  const l2Portal = new L2Portal(l2PortalAddr, l2Client);

  const claimTx = await l2Portal.claimDeposit(l1TokenAddr, recipient, amount, depositResult.messageIndex, {
    from: l2Client.getAddress(),
    fee: l2Client.getFeeOpts(),
  });

  console.log(`L2 claim tx submitted: ${await claimTx.getTxHash()}`);
  const claimReceipt = await claimTx.wait();
  if (claimReceipt.status !== TxStatus.SUCCESS) {
    throw new Error(`L2 claim transaction failed: ${claimReceipt}`);
  }
  console.log(`L2 claim of ${amount} ${symbol} succeeded in tx ${claimReceipt.txHash}`);
}
