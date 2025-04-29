import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { anvil, sepolia, mainnet } from 'viem/chains';
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  type Account,
  type Chain,
  type Transport,
  type Hex,
} from 'viem';
import { Fr, Fq } from '@aztec/aztec.js';
import { computePartialAddress } from '@aztec/stdlib/contract';
import { createPXEService, type PXEServiceConfig } from '@aztec/pxe/server';
import type {
  AccountWallet,
  AztecAddress,
  AztecNode,
  PXE,
  Wallet as AztecWallet,
} from '@aztec/aztec.js';
import {
  getSchnorrAccount,
  getSchnorrWallet,
  getSchnorrWalletWithSecretKey,
} from '@aztec/accounts/schnorr';
import { getDeployedTestAccountsWallets } from '@aztec/accounts/testing';
import { deriveSigningKey } from '@aztec/stdlib/keys';
import { L1Client, L2Client } from '@turnstile-portal/turnstile.js';

import { readKeyData, type KeyData } from './keyData.js';

export async function createPXE(
  node: AztecNode,
  config?: PXEServiceConfig | undefined,
): Promise<PXE> {
  if (!config) {
    console.log('Creating PXE service with default config...');
    const l1Contracts = await node.getL1ContractAddresses();
    const { l1ChainId, rollupVersion } = await node.getNodeInfo();
    // biome-ignore lint/style/noParameterAssign: only assigning if undefined
    config = {
      l2BlockBatchSize: 200,
      l2BlockPollingIntervalMS: 100,
      dataDirectory: undefined,
      dataStoreMapSizeKB: 1024 * 1024,
      l1Contracts,
      l1ChainId,
      rollupVersion,
      proverEnabled: l1ChainId !== 31337,
    } as PXEServiceConfig;
  }

  const pxe = await createPXEService(node, config);
  return pxe;
}

export async function generateAndDeployAztecAccountSchnorr(
  pxe: PXE,
): Promise<{ salt: Fr; encKey: Fr; signingKey: Fq; wallet: AztecWallet }> {
  const { salt, encKey, signingKey } = await generateAztecAccountSchnorr(pxe);
  const wallet = await deployAztecAccountSchnorr(pxe, encKey, signingKey, salt);
  return { salt, encKey, signingKey, wallet };
}

export async function generateAztecAccountSchnorr(
  pxe: PXE,
): Promise<{ salt: Fr; encKey: Fr; signingKey: Fq }> {
  const salt = Fr.random();
  const encKey = Fr.random();
  const signingKey = deriveSigningKey(encKey);
  return {
    salt,
    encKey,
    signingKey,
  };
}

export async function deployAztecAccountSchnorr(
  pxe: PXE,
  encKey: Fr,
  signingKey: Fq,
  salt: Fr,
): Promise<AztecWallet> {
  const deployWallet = (await getDeployedTestAccountsWallets(pxe))[0];
  const accountManager = await getSchnorrAccount(pxe, encKey, signingKey, salt);
  const wallet = await accountManager.deploy({ deployWallet }).getWallet();
  console.log(`Account deployed at ${wallet.getAddress()}`);
  return wallet;
}

export async function getAztecSchnorrAccountFromSigningKey(
  pxe: PXE,
  address: AztecAddress,
  signingKey: Fq,
): Promise<AccountWallet> {
  return getSchnorrWallet(pxe, address, signingKey);
}

export function generateEthAccount(): { privateKey: Hex; address: Hex } {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return {
    privateKey,
    address: account.address,
  };
}

export async function getClients(
  aztecNode: AztecNode,
  l1Config: { chain: Chain; transport: Transport },
  keyDataFile: string,
): Promise<{
  l1Client: L1Client;
  l2Client: L2Client;
}> {
  // Add console logging to help debug
  console.log('Reading key data from:', keyDataFile);
  const keyData = await readKeyData(keyDataFile);
  // console.log('KeyData received:', JSON.stringify(keyData, null, 2));

  // Add a safeguard to ensure we have the required fields
  if (!keyData || !keyData.l1PrivateKey) {
    throw new Error(
      `Invalid keyData: missing l1PrivateKey in ${JSON.stringify(keyData)}`,
    );
  }

  return {
    l1Client: await createL1Client(l1Config, keyData),
    l2Client: await createL2Client(aztecNode, keyData),
  };
}

export async function createL1Client(
  l1Config: { chain: Chain; transport: Transport },
  keyData: KeyData,
): Promise<L1Client> {
  const l1Account: Account = privateKeyToAccount(keyData.l1PrivateKey);
  const l1WalletClient = createWalletClient({
    account: l1Account,
    chain: l1Config.chain,
    transport: l1Config.transport,
  });
  const l1PublicClient = createPublicClient({
    chain: l1Config.chain,
    transport: l1Config.transport,
  });

  return new L1Client(l1PublicClient, l1WalletClient);
}

export async function createL2Client(
  node: AztecNode,
  keyData: KeyData,
  pxe?: PXE,
): Promise<L2Client> {
  if (!pxe) {
    // biome-ignore lint/style/noParameterAssign: only assigning if undefined
    pxe = await createPXE(node);
  }
  const account = await getSchnorrAccount(
    pxe,
    Fr.fromString(keyData.l2SecretKey),
    Fq.fromString(keyData.l2SigningKey),
    Fr.fromString(keyData.l2Salt),
  );
  const wallet = await account.register();
  const client = new L2Client(node, pxe, wallet);
  return client;
}

const devnet = defineChain({
  id: 1337,
  name: '',
  nativeCurrency: {
    name: '',
    symbol: '',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [],
      webSocket: undefined,
    },
  },
});

export function getChain(chain: string): Chain {
  switch (chain) {
    case 'mainnet':
      return mainnet;
    case 'sepolia':
      return sepolia;
    case 'anvil':
      return anvil;
    case 'devnet':
      return devnet;
    default:
      throw new Error(`Unsupported chain: ${chain}`);
  }
}

export async function anvilFundMe(
  address: Hex,
  amount: bigint,
  rpcUrl: string,
) {
  const anvilKey =
    '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6';
  const anvilAccount = privateKeyToAccount(anvilKey);
  const anvilWallet = createWalletClient({
    account: anvilAccount,
    chain: anvil,
    transport: http(rpcUrl),
  });
  console.log(`Funding ${address} with ${amount} ETH...`);
  const receipt = await anvilWallet.sendTransaction({
    to: address,
    value: amount,
  });
  console.log(`Funded in tx ${receipt}`);
}
