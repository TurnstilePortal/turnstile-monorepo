import { AztecAddress, type ContractClassWithId, getContractClassFromArtifact } from '@aztec/aztec.js';
import { hexToBuffer } from '@aztec/foundation/string';
import { SerializableContractInstance } from '@aztec/stdlib/contract';
import { ShieldGatewayContractArtifact } from '@turnstile-portal/aztec-artifacts';
import { getFactoryPromise } from '../factory.js';
import type { ContractHelper } from './index.js';

export async function getShieldGatewayContractClass(): Promise<ContractClassWithId> {
  const contractClass = await getContractClassFromArtifact(ShieldGatewayContractArtifact);
  return contractClass;
}

export async function getShieldGatewayContractInstance() {
  const factory = await getFactoryPromise();
  const deploymentData = factory.getDeploymentData();

  const shieldGatewayInstance = SerializableContractInstance.fromBuffer(
    hexToBuffer(deploymentData.serializedShieldGatewayInstance),
  ).withAddress(AztecAddress.fromString(deploymentData.aztecShieldGateway));

  return shieldGatewayInstance;
}

export const shieldGatewayHelper: ContractHelper = {
  name: 'ShieldGateway',
  getContractClass: getShieldGatewayContractClass,
  getArtifact: () => Promise.resolve(ShieldGatewayContractArtifact),
  getContractInstance: getShieldGatewayContractInstance,
  getInitializationData: () => Promise.resolve(undefined),
};
