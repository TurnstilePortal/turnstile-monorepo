import { AztecAddress, type ContractClassWithId, getContractClassFromArtifact } from '@aztec/aztec.js';
import { hexToBuffer } from '@aztec/foundation/string';
import { SerializableContractInstance } from '@aztec/stdlib/contract';
import type { ContractInstantiationData } from '@turnstile-portal/api-common';
import { PortalContractArtifact } from '@turnstile-portal/aztec-artifacts';
import { L2_CONTRACT_DEPLOYMENT_SALT } from '@turnstile-portal/turnstile.js';
import { getFactoryPromise } from '../factory.js';
import type { ContractHelper } from './index.js';

export async function getPortalContractClass(): Promise<ContractClassWithId> {
  const contractClass = await getContractClassFromArtifact(PortalContractArtifact);
  return contractClass;
}

export async function getPortalContractInstance() {
  const factory = await getFactoryPromise();
  const deploymentData = factory.getDeploymentData();

  const portalInstance = SerializableContractInstance.fromBuffer(
    hexToBuffer(deploymentData.serializedAztecPortalInstance),
  ).withAddress(AztecAddress.fromString(deploymentData.aztecPortal));

  return portalInstance;
}

export async function getPortalDeploymentParams(): Promise<ContractInstantiationData> {
  const factory = await getFactoryPromise();
  const deploymentData = factory.getDeploymentData();
  return {
    constructorArtifact: 'constructor',
    constructorArgs: [
      deploymentData.l1Portal,
      deploymentData.aztecTokenContractClassID,
      deploymentData.aztecShieldGateway,
    ],
    salt: L2_CONTRACT_DEPLOYMENT_SALT.toString(),
    publicKeys: (await getPortalContractInstance()).publicKeys.toString(),
    deployer: AztecAddress.ZERO.toString(),
  };
}

export const portalHelper: ContractHelper = {
  name: 'Portal',
  getContractClass: getPortalContractClass,
  getArtifact: () => Promise.resolve(PortalContractArtifact),
  getContractInstance: getPortalContractInstance,
  getDeploymentParams: getPortalDeploymentParams,
};
