import { createPublicClient, createWalletClient, http } from 'viem';
import type { Account, Chain, Transport, WalletClient } from 'viem';

import { privateKeyToAccount } from 'viem/accounts';
import { anvil } from 'viem/chains';

// Keys/addresses are for the Turnstile local anvil test node setup
export const BRIDGE_USER_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
export const BRIDGE_USER_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

export const APPROVER_ADDRESS = '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720';
export const APPROVER_PRIVATE_KEY =
  '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6';

const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';

export const bridgeUserAccount = privateKeyToAccount(BRIDGE_USER_PRIVATE_KEY);
export const approverAccount = privateKeyToAccount(APPROVER_PRIVATE_KEY);

export const bridgeUserWallet: WalletClient<Transport, Chain, Account> =
  createWalletClient({
    account: bridgeUserAccount,
    chain: anvil,
    transport: http(RPC_URL),
  });

export const approverWallet: WalletClient<Transport, Chain, Account> =
  createWalletClient({
    account: approverAccount,
    chain: anvil,
    transport: http(RPC_URL),
  });

export const publicClient = createPublicClient({
  chain: anvil,
  transport: http(RPC_URL),
});
