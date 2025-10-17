import { getSchnorrAccount } from '@aztec/accounts/schnorr';
import { getDeployedTestAccountsWallets } from '@aztec/accounts/testing';
import type { AztecNode, Wallet as AztecWallet, PXE } from '@aztec/aztec.js';
import { createAztecNodeClient, Fr, GrumpkinScalar, waitForNode, waitForPXE } from '@aztec/aztec.js';
import { createStore } from '@aztec/kv-store/lmdb';
import { createPXEService, getPXEServiceConfig } from '@aztec/pxe/server';
import { deriveSigningKey } from '@aztec/stdlib/keys';
import { L1Client } from '@turnstile-portal/turnstile.js';
import { type Account, type Chain, createPublicClient, createWalletClient, defineChain, type Transport } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { anvil, mainnet, sepolia } from 'viem/chains';
import { DevL2Client } from './aztec/devL2Client.js';
import { type KeyData, readKeyData } from './keyData.js';

export async function createPXE(node: AztecNode): Promise<PXE> {
  const l1Contracts = await node.getL1ContractAddresses();
  const nodeInfo = await node.getNodeInfo();

  // Manually creating data store due to missing native bindings files
  // https://github.com/AztecProtocol/aztec-packages/issues/13904
  const store = await createStore('pxe', {
    dataDirectory: undefined, // ephemeral store
    dataStoreMapSizeKB: 1e6,
  });

  const config = getPXEServiceConfig();
  const fullConfig = {
    ...config,
    l1Contracts,
    l1ChainId: nodeInfo.l1ChainId,
    rollupVersion: nodeInfo.rollupVersion,
  };

  // TODO(twt): make this configurable so we can prove in sandbox when desired
  fullConfig.proverEnabled = nodeInfo.l1ChainId !== 31337 && nodeInfo.l1ChainId !== 1337;

  const pxe = await createPXEService(node, fullConfig, { store });
  console.log('Waiting for PXE service to be ready...');
  await waitForPXE(pxe);
  console.log('PXE service ready');
  return pxe;
}

export async function generateAztecAccountSchnorr(
  _pxe: PXE,
): Promise<{ salt: Fr; secretKey: Fr; signingKey: GrumpkinScalar }> {
  const salt = Fr.random();
  const secretKey = Fr.random();
  const signingKey = deriveSigningKey(secretKey);
  return {
    salt,
    secretKey,
    signingKey,
  };
}

export async function deployAztecAccountSchnorr(
  pxe: PXE,
  secretKey: Fr,
  signingKey: GrumpkinScalar,
  salt: Fr,
): Promise<AztecWallet> {
  const deployWallet = (await getDeployedTestAccountsWallets(pxe))[0];
  const accountManager = await getSchnorrAccount(pxe, secretKey, signingKey, salt);
  const wallet = await accountManager.deploy({ deployWallet }).getWallet();
  console.log(`Account deployed at ${wallet.getAddress()}`);
  return wallet;
}

export async function getClients(
  l2Config: { node: string },
  l1Config: { chain: Chain; transport: Transport },
  keyDataFile: string,
  _pxe?: PXE,
): Promise<{
  l1Client: L1Client;
  l2Client: DevL2Client;
}> {
  const keyData = await readKeyData(keyDataFile);
  if (!keyData || !keyData.l1PrivateKey) {
    throw new Error(`Invalid keyData: missing l1PrivateKey in ${JSON.stringify(keyData)}`);
  }

  return {
    l1Client: await createL1Client(l1Config, keyData),
    l2Client: await createL2Client(l2Config, keyData),
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
  l2Config: { node: string },
  keyData: Pick<KeyData, 'l2SecretKey' | 'l2SigningKey' | 'l2Salt'>,
  pxe?: PXE,
): Promise<DevL2Client> {
  const node = createAztecNodeClient(l2Config.node);
  console.log(`Connecting to Aztec Node at ${l2Config.node}`);
  await waitForNode(node);
  console.log('Aztec Node is ready');
  if (!pxe) {
    // biome-ignore lint/style/noParameterAssign: only assigning if undefined
    pxe = await createPXE(node);
  }
  const account = await getSchnorrAccount(
    pxe,
    Fr.fromString(keyData.l2SecretKey),
    GrumpkinScalar.fromString(keyData.l2SigningKey),
    Fr.fromString(keyData.l2Salt),
  );
  const wallet = await account.register();
  return new DevL2Client(node, wallet, pxe);
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
