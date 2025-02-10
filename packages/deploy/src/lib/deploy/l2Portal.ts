import type { AztecAddress, Fr, EthAddress, Wallet } from '@aztec/aztec.js';
import { getContractClassFromArtifact, TxStatus } from '@aztec/aztec.js';
import { registerContractClass } from '@aztec/aztec.js/deployment';

import {
  PortalContract,
  ShieldGatewayContract,
  TokenContractArtifact,
  BeaconContract,
  ShieldGatewayStorageContract,
} from '@turnstile-portal/aztec-artifacts';

export async function deployBeacon(
  wallet: Wallet,
  adminAddr: AztecAddress,
  targetAddr: AztecAddress,
): Promise<BeaconContract> {
  const beacon = await BeaconContract.deploy(wallet, adminAddr, targetAddr)
    .send()
    .deployed();

  console.log(`Beacon deployed at ${beacon.address.toString()}`);
  return beacon;
}

export async function deployShieldGateway(
  adminWallet: Wallet,
  defaultThreshold = 5_000_000_000_000_000_000n, // 5 & 18 zeros
): Promise<{
  storage: ShieldGatewayStorageContract;
  shieldGateway: ShieldGatewayContract;
}> {
  const storage = await deployShieldGatewayStorage(
    adminWallet,
    adminWallet.getAddress(),
  );

  const shieldGateway = await ShieldGatewayContract.deploy(
    adminWallet,
    adminWallet.getAddress(),
    storage.address,
    defaultThreshold,
  )
    .send()
    .deployed();
  console.log(`Shield Gateway deployed at ${shieldGateway.address.toString()}`);

  // Set the shield gateway address in the storage contract
  const sentTx = await storage.methods
    .set_authorized_caller(shieldGateway.address)
    .send();
  const receipt = await sentTx.wait();
  if (receipt.status !== TxStatus.SUCCESS) {
    throw new Error(`Failed to set authorized caller: ${receipt}`);
  }

  return { storage, shieldGateway };
}

export async function deployShieldGatewayStorage(
  wallet: Wallet,
  adminAddr: AztecAddress,
): Promise<ShieldGatewayStorageContract> {
  const storage = await ShieldGatewayStorageContract.deploy(wallet, adminAddr)
    .send()
    .deployed();
  console.log(
    `Shield Gateway Storage deployed at ${storage.address.toString()}`,
  );
  return storage;
}

export async function deployTurnstileTokenPortal(
  wallet: Wallet,
  l1Portal: EthAddress,
  tokenContractClass: Fr,
  shieldGatewayBeaconAddr: AztecAddress,
): Promise<PortalContract> {
  const portal = await PortalContract.deploy(
    wallet,
    l1Portal,
    tokenContractClass,
    shieldGatewayBeaconAddr,
  )
    .send()
    .deployed();
  console.log(`Portal deployed at ${portal.address.toString()}`);
  return portal;
}

export async function registerTurnstileTokenContractClass(
  wallet: Wallet,
): Promise<Fr> {
  const tx = await registerContractClass(wallet, TokenContractArtifact);
  const receipt = await tx.send().wait();
  if (receipt.status !== TxStatus.SUCCESS) {
    throw new Error(`Failed to register contract class: ${receipt}`);
  }
  const tokenContractClass = await getContractClassFromArtifact(
    TokenContractArtifact,
  );
  console.log(`Registered contract class ${tokenContractClass.id.toString()}`);
  return tokenContractClass.id;
}
