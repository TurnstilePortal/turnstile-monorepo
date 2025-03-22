import type { AztecAddress, Fr, EthAddress, Wallet } from '@aztec/aztec.js';
import { getContractClassFromArtifact, TxStatus } from '@aztec/aztec.js';
import { registerContractClass } from '@aztec/aztec.js/deployment';
import type { L2Client } from '@turnstile-portal/turnstile.js';

import {
  PortalContract,
  ShieldGatewayContract,
  TokenContractArtifact,
  BeaconContract,
} from '@turnstile-portal/aztec-artifacts';

export async function deployBeacon(
  l2Client: L2Client,
  adminAddr: AztecAddress,
  targetAddr: AztecAddress,
): Promise<BeaconContract> {
  const beacon = await BeaconContract.deploy(
    l2Client.getWallet(),
    adminAddr,
    targetAddr,
  )
    .send({ fee: l2Client.getFeeOpts() })
    .deployed();

  console.log(`Beacon deployed at ${beacon.address.toString()}`);
  return beacon;
}

export async function deployShieldGateway(
  l2ClientAdmin: L2Client,
): Promise<ShieldGatewayContract> {
  const shieldGateway = await ShieldGatewayContract.deploy(
    l2ClientAdmin.getWallet(),
  )
    .send({ fee: l2ClientAdmin.getFeeOpts() })
    .deployed();
  console.log(`Shield Gateway deployed at ${shieldGateway.address.toString()}`);

  return shieldGateway;
}

export async function deployTurnstileTokenPortal(
  l2Client: L2Client,
  l1Portal: EthAddress,
  tokenContractClass: Fr,
  shieldGatewayBeaconAddr: AztecAddress,
): Promise<PortalContract> {
  const portal = await PortalContract.deploy(
    l2Client.getWallet(),
    l1Portal,
    tokenContractClass,
    shieldGatewayBeaconAddr,
  )
    .send({ fee: l2Client.getFeeOpts() })
    .deployed();
  console.log(`Portal deployed at ${portal.address.toString()}`);
  return portal;
}

export async function registerTurnstileTokenContractClass(
  l2Client: L2Client,
): Promise<Fr> {
  console.log('Registering Turnstile Token contract class...');
  const tx = await registerContractClass(
    l2Client.getWallet(),
    TokenContractArtifact,
  );
  const receipt = await tx.send({ fee: l2Client.getFeeOpts() }).wait();
  if (receipt.status !== TxStatus.SUCCESS) {
    throw new Error(`Failed to register contract class: ${receipt}`);
  }
  const tokenContractClass = await getContractClassFromArtifact(
    TokenContractArtifact,
  );
  console.log(`Registered contract class ${tokenContractClass.id.toString()}`);
  return tokenContractClass.id;
}
