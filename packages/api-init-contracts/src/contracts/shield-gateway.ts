import { AztecAddress, type ContractClassWithId, getContractClassFromArtifact } from '@aztec/aztec.js';
import { hexToBuffer } from '@aztec/foundation/string';
import { SerializableContractInstance } from '@aztec/stdlib/contract';
import type { ContractInstantiationData } from '@turnstile-portal/api-common';
import { ShieldGatewayContractArtifact } from '@turnstile-portal/aztec-artifacts';
import { L2_CONTRACT_DEPLOYMENT_SALT } from '@turnstile-portal/turnstile.js';
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

export async function getShieldGatewayDeploymentParams(): Promise<ContractInstantiationData> {
  return {
    salt: L2_CONTRACT_DEPLOYMENT_SALT.toString(),
    publicKeys: (await getShieldGatewayContractInstance()).publicKeys.toString(),
    deployer: AztecAddress.ZERO.toString(),
  };
}

export const shieldGatewayHelper: ContractHelper = {
  name: 'ShieldGateway',
  getContractClass: getShieldGatewayContractClass,
  getArtifact: () => Promise.resolve(ShieldGatewayContractArtifact),
  getContractInstance: getShieldGatewayContractInstance,
  getDeploymentParams: getShieldGatewayDeploymentParams,
};
