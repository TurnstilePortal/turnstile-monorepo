import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { anvil, mainnet } from 'viem/chains';
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  type Account,
  type Chain,
  type PublicClient,
  type Transport,
  type WalletClient,
  type Hex,
} from 'viem';
import {
  AztecAddress,
  Fr,
  Fq,
  type Wallet as AztecWallet,
} from '@aztec/aztec.js';
import { getSchnorrAccount, getSchnorrWallet } from '@aztec/accounts/schnorr';
import type { AccountWallet, PXE } from '@aztec/aztec.js';

import { readKeyData, type KeyData } from './keyData.js';

export type L1ComboWallet = {
  public: PublicClient;
  wallet: WalletClient<Transport, Chain, Account>;
};

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
  const signingKey = Fq.random();
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
  const accountManager = await getSchnorrAccount(pxe, encKey, signingKey, salt);
  const wallet = await accountManager.deploy().getWallet();
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

export async function getWallets(
  pxe: PXE,
  l1Config: { chain: Chain; transport: Transport },
  keyDataFile: string,
): Promise<{ l1Wallet: L1ComboWallet; l2Wallet: AccountWallet }> {
  const keyData = await readKeyData(keyDataFile);
  return {
    l1Wallet: await getL1Wallet(l1Config, keyData),
    l2Wallet: await getL2Wallet(pxe, keyData),
  };
}

export async function getL1Wallet(
  l1Config: { chain: Chain; transport: Transport },
  keyData: KeyData,
): Promise<L1ComboWallet> {
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

  return { public: l1PublicClient, wallet: l1WalletClient };
}

export async function getL2Wallet(
  pxe: PXE,
  keyData: KeyData,
): Promise<AccountWallet> {
  return getSchnorrWallet(
    pxe,
    AztecAddress.fromString(keyData.l2Address),
    Fq.fromString(keyData.l2SigningKey),
  );
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
  await anvilWallet.sendTransaction({ to: address, value: amount });
}
