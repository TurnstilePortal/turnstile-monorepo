import { getContract, type Hex, type Address } from 'viem';
import type { AztecAddress, Wallet as AztecWallet } from '@aztec/aztec.js';

import type { L1Client } from '@turnstile-portal/turnstile.js';
import { TokenContract } from '@turnstile-portal/aztec-artifacts';

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

export async function deployL1DevToken(
  client: L1Client,
  name: string,
  symbol: string,
  decimals: number,
) {
  // Import the artifacts directly
  const { InsecureMintableTokenABI, InsecureMintableTokenBytecode } =
    await import('@turnstile-portal/l1-artifacts-dev');

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
    authorizationList: [],
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

export async function fundL1DevToken(
  client: L1Client,
  tokenAddr: Hex,
  amount: bigint,
) {
  // Import the artifacts to get the ABI
  const { InsecureMintableTokenABI } = await import(
    '@turnstile-portal/l1-artifacts-dev'
  );

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
    authorizationList: [],
  });
  const mintReceipt = await publicClient.waitForTransactionReceipt({
    hash: mintHash,
  });
  if (mintReceipt.status !== 'success') {
    throw new Error(`Mint failed: ${mintReceipt}`);
  }
  console.log(
    `InsecureMintableToken(${tokenAddr}) minted ${amount} for ${walletAddress}`,
  );

  // Fund additional addresses
  for (const a of ADDITIONAL_L1_ADDRESSES_TO_FUND) {
    const additionalMintHash = await tokenContract.write.mint([a, amount], {
      account,
      chain: walletClient.chain,
      authorizationList: [],
    });
    const additionalMintReceipt = await publicClient.waitForTransactionReceipt({
      hash: additionalMintHash,
    });
    if (additionalMintReceipt.status !== 'success') {
      throw new Error(`Additional mint failed: ${additionalMintReceipt}`);
    }
    console.log(
      `InsecureMintableToken(${tokenAddr}) minted ${amount} for ${a}`,
    );
  }
}

export async function deployL2DevToken(
  wallet: AztecWallet,
  aztecPortal: AztecAddress,
  name: string,
  symbol: string,
  decimals: number,
): Promise<Hex> {
  try {
    // Using the aztec-artifacts TokenContract directly
    const token = await TokenContract.deploy(
      wallet,
      aztecPortal,
      name,
      symbol,
      decimals,
    )
      .send()
      .deployed();

    console.log(`TokenContract deployed at ${token.address.toString()}`);
    return token.address.toString();
  } catch (error) {
    console.error(`Error deploying L2 token: ${error}`);
    throw error;
  }
}
