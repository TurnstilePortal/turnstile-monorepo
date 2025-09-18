import { AztecAddress, type ContractClassWithId, getContractClassFromArtifact } from '@aztec/aztec.js';
import { SerializableContractInstance } from '@aztec/stdlib/contract';

import {
  PortalContractArtifact,
  ShieldGatewayContractArtifact,
  TokenContractArtifact,
} from '@turnstile-portal/aztec-artifacts';

import { type NetworkName, TurnstileFactory } from '@turnstile-portal/turnstile.js';

const NETWORK = (process.env.TURNSTILE_NETWORK as NetworkName) || 'sandbox';

export const factoryPromise = TurnstileFactory.fromConfig(NETWORK);

export async function getContractClasses(): Promise<{
  portalContractClass: ContractClassWithId;
  shieldGatewayContractClass: ContractClassWithId;
  tokenContractClass: ContractClassWithId;
}> {
  const [portalContractClass, shieldGatewayContractClass, tokenContractClass] = await Promise.all([
    getContractClassFromArtifact(PortalContractArtifact),
    getContractClassFromArtifact(ShieldGatewayContractArtifact),
    getContractClassFromArtifact(TokenContractArtifact),
  ]);
  portalContractClass.id;
  portalContractClass.artifactHash;

  return {
    portalContractClass,
    shieldGatewayContractClass,
    tokenContractClass,
  };
}

export async function getContractInstances() {
  const factory = await factoryPromise;
  const deploymentData = factory.getDeploymentData();

  const portalInstance = SerializableContractInstance.fromBuffer(
    Buffer.from(deploymentData.serializedAztecPortalInstance.substring(2), 'hex'),
  ).withAddress(AztecAddress.fromString(deploymentData.aztecPortal));

  const shieldGatewayInstance = SerializableContractInstance.fromBuffer(
    Buffer.from(deploymentData.serializedShieldGatewayInstance.substring(2), 'hex'),
  ).withAddress(AztecAddress.fromString(deploymentData.aztecShieldGateway));

  return { portalInstance, shieldGatewayInstance };
}
