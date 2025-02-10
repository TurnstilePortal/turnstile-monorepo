import type { Hex } from 'viem';
import {
  ERC20AllowListBytecode,
  ERC20TokenPortalBytecode,
} from '@turnstile-portal/l1-artifacts-bytecode';
import {
  ERC20AllowListABI,
  ERC20TokenPortalABI,
} from '@turnstile-portal/l1-artifacts-abi';
import type { L1ComboWallet } from '@turnstile-portal/turnstile-dev';

import { L1TokenPortal } from '@turnstile-portal/turnstile.js';

export async function deployERC20AllowList(
  w: L1ComboWallet,
  adminAddr: Hex,
  approverAddr: Hex,
): Promise<Hex> {
  const txHash = await w.wallet.deployContract({
    abi: ERC20AllowListABI,
    bytecode: ERC20AllowListBytecode,
    args: [adminAddr, approverAddr],
  });
  const receipt = await w.public.waitForTransactionReceipt({ hash: txHash });
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
  w: L1ComboWallet,
  aztecRegistryAddr: Hex,
  allowListAddr: Hex,
  l2PortalInitializerAddr: Hex,
): Promise<Hex> {
  const txHash = await w.wallet.deployContract({
    abi: ERC20TokenPortalABI,
    bytecode: ERC20TokenPortalBytecode,
    args: [aztecRegistryAddr, allowListAddr, l2PortalInitializerAddr],
  });

  const receipt = await w.public.waitForTransactionReceipt({ hash: txHash });
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
  w: L1ComboWallet,
  l1Portal: Hex,
  l2Portal: Hex,
) {
  const portal = new L1TokenPortal(l1Portal, w.wallet, w.public);
  const receipt = await portal.setL2Portal(l2Portal);
  if (receipt.status !== 'success') {
    throw new Error(`setL2Portal() failed: ${receipt}`);
  }
  console.log(`L2 Portal set on L1 Portal in tx ${receipt.transactionHash}`);
}
