import {
  AztecAddress,
  type ContractClassWithId,
  encodeArguments,
  Fr,
  getContractClassFromArtifact,
} from '@aztec/aztec.js';
import { hexToBuffer } from '@aztec/foundation/string';
import { SerializableContractInstance } from '@aztec/stdlib/contract';
import { getFunctionAbi, type InitializationData } from '@aztec-artifacts/client';
import { PortalContractArtifact } from '@turnstile-portal/aztec-artifacts';
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

export async function getPortalDeploymentParams(): Promise<InitializationData> {
  const factory = await getFactoryPromise();
  const deploymentData = factory.getDeploymentData();

  const functionAbi = getFunctionAbi(PortalContractArtifact, 'constructor');
  const encodedArgs = encodeArguments(functionAbi, [
    AztecAddress.fromString(deploymentData.aztecPortal),
    Fr.fromHexString(deploymentData.aztecTokenContractClassID),
    AztecAddress.fromString(deploymentData.aztecShieldGateway),
  ]);

  return {
    constructorName: 'constructor',
    encodedArgs,
  };
}

export const portalHelper: ContractHelper = {
  name: 'Portal',
  getContractClass: getPortalContractClass,
  getArtifact: () => Promise.resolve(PortalContractArtifact),
  getContractInstance: getPortalContractInstance,
  getInitializationData: getPortalDeploymentParams,
};
