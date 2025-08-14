import {
  ERC20AllowListABI,
  ERC20TokenPortalABI,
} from '@turnstile-portal/l1-artifacts-abi';
import {
  ERC20AllowListBytecode,
  ERC20TokenPortalBytecode,
} from '@turnstile-portal/l1-artifacts-bytecode';
import type { L1Client } from '@turnstile-portal/turnstile.js';
import { L1Portal } from '@turnstile-portal/turnstile.js';
import type { Hex } from 'viem';

export async function deployERC20AllowList(
  client: L1Client,
  adminAddr: Hex,
  approverAddr: Hex,
): Promise<Hex> {
  console.log('Deploying AllowList...');
  const walletClient = client.getWalletClient();
  const account = walletClient.account;
  if (!account) {
    throw new Error('No account connected to wallet client');
  }

  const txHash = await walletClient.deployContract({
    abi: ERC20AllowListABI,
    bytecode: ERC20AllowListBytecode,
    args: [adminAddr, approverAddr],
    account,
    chain: walletClient.chain,
  });
  console.log('AllowList deployed with tx hash:', txHash);
  const receipt = await client
    .getPublicClient()
    .waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== 'success') {
    throw new Error(`Deploy failed: ${receipt}`);
  }
  const contractAddr = receipt.contractAddress;
  if (!contractAddr) {
    throw new Error(`Contract address not found in receipt: ${receipt}`);
  }
  console.log(`AllowList deployed at ${contractAddr}`);
  return contractAddr;
}

export async function deployERC20TokenPortal(
  client: L1Client,
  aztecRegistryAddr: Hex,
  allowListAddr: Hex,
  l2PortalInitializerAddr: Hex,
): Promise<Hex> {
  console.log('Deploying L1 TokenPortal...');
  const walletClient = client.getWalletClient();
  const account = walletClient.account;
  if (!account) {
    throw new Error('No account connected to wallet client');
  }

  const txHash = await walletClient.deployContract({
    abi: ERC20TokenPortalABI,
    bytecode: ERC20TokenPortalBytecode,
    args: [aztecRegistryAddr, allowListAddr, l2PortalInitializerAddr],
    account,
    chain: walletClient.chain,
  });

  const receipt = await client
    .getPublicClient()
    .waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== 'success') {
    throw new Error(`Deploy failed: ${receipt}`);
  }

  const contractAddr = receipt.contractAddress;
  if (!contractAddr) {
    throw new Error(`Contract address not found in receipt: ${receipt}`);
  }
  console.log(`TokenPortal deployed at ${contractAddr}`);
  return contractAddr;
}

export async function setL2PortalOnL1Portal(
  client: L1Client,
  l1Portal: Hex,
  l2Portal: Hex,
) {
  // Use the provided L1Client directly
  const portal = new L1Portal(l1Portal, client);
  const receipt = await portal.setL2Portal(l2Portal);
  if (receipt.status !== 'success') {
    throw new Error(`setL2Portal() failed: ${receipt}`);
  }
  console.log(`L2 Portal set on L1 Portal in tx ${receipt.transactionHash}`);
}
