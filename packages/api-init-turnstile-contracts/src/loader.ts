import type { NewContractArtifact, NewContractInstance } from '@turnstile-portal/api-common/schema';
import {
  getContractArtifactByHash,
  getContractInstanceByAddress,
  storeContractArtifact,
  storeContractInstance,
} from './db.js';
import { getContractClasses, getContractInstances } from './util.js';

export async function loadTurnstileContracts(): Promise<{
  artifactsStored: number;
  instancesStored: number;
}> {
  console.log('Loading Turnstile contract data...');

  const { portalContractClass, shieldGatewayContractClass, tokenContractClass } = await getContractClasses();

  const contractClasses = [
    { name: 'Portal', class: portalContractClass },
    { name: 'ShieldGateway', class: shieldGatewayContractClass },
    { name: 'Token', class: tokenContractClass },
  ];

  let artifactsStored = 0;

  for (const { name, class: contractClass } of contractClasses) {
    const artifactHash = contractClass.artifactHash.toString();
    const contractClassId = contractClass.id.toString();

    const existingArtifact = await getContractArtifactByHash(artifactHash);
    if (existingArtifact) {
      console.log(`${name} artifact already exists with hash: ${artifactHash}`);
      continue;
    }

    const newArtifact: NewContractArtifact = {
      artifactHash,
      artifact: contractClass.artifact,
      contractClassId,
    };

    await storeContractArtifact(newArtifact);
    console.log(`Stored ${name} artifact with hash: ${artifactHash}`);
    artifactsStored++;
  }

  const { portalInstance, shieldGatewayInstance } = await getContractInstances();

  const instances = [
    { name: 'Portal', instance: portalInstance },
    { name: 'ShieldGateway', instance: shieldGatewayInstance },
  ];

  let instancesStored = 0;

  for (const { name, instance } of instances) {
    const address = instance.address.toString();

    const existingInstance = await getContractInstanceByAddress(address);
    if (existingInstance) {
      console.log(`${name} instance already exists at address: ${address}`);
      continue;
    }

    const deploymentParams = {
      publicKeys: instance.publicKeys,
    };

    const newInstance: NewContractInstance = {
      address,
      originalContractClassId: instance.originalContractClassId.toString(),
      currentContractClassId: instance.currentContractClassId.toString(),
      initializationHash: instance.initializationHash?.toString() ?? null,
      deploymentParams,
      version: instance.version,
    };

    await storeContractInstance(newInstance);
    console.log(`Stored ${name} instance at address: ${address}`);
    instancesStored++;
  }

  console.log(`Contract data loading complete. Artifacts: ${artifactsStored}, Instances: ${instancesStored}`);

  return {
    artifactsStored,
    instancesStored,
  };
}
