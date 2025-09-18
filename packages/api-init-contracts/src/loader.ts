import type { NewContractArtifact, NewContractInstance } from '@turnstile-portal/api-common/schema';
import { portalHelper, shieldGatewayHelper, tokenHelper } from './contracts/index.js';
import {
  getContractArtifactByHash,
  getContractInstanceByAddress,
  storeContractArtifact,
  storeContractInstance,
} from './db.js';

export async function loadTurnstileContracts(): Promise<{
  artifactsStored: number;
  instancesStored: number;
}> {
  console.log('Loading Turnstile contract data...');

  const helpers = [portalHelper, shieldGatewayHelper, tokenHelper];

  let artifactsStored = 0;
  let instancesStored = 0;

  for (const helper of helpers) {
    // Load artifact
    const contractClass = await helper.getContractClass();
    const artifactHash = contractClass.artifactHash.toString();
    const contractClassId = contractClass.id.toString();

    const existingArtifact = await getContractArtifactByHash(artifactHash);
    if (existingArtifact) {
      console.log(`${helper.name} artifact already exists with hash: ${artifactHash}`);
    } else {
      const newArtifact: NewContractArtifact = {
        artifactHash,
        artifact: helper.getArtifact(),
        contractClassId,
      };

      await storeContractArtifact(newArtifact);
      console.log(`Stored ${helper.name} artifact with hash: ${artifactHash}`);
      artifactsStored++;
    }

    // Load instance if available
    if (helper.getContractInstance && helper.getDeploymentParams) {
      const instance = await helper.getContractInstance();
      const address = instance.address.toString();

      const existingInstance = await getContractInstanceByAddress(address);
      if (existingInstance) {
        console.log(`${helper.name} instance already exists at address: ${address}`);
      } else {
        const deploymentParams = await helper.getDeploymentParams();

        const newInstance: NewContractInstance = {
          address,
          originalContractClassId: instance.originalContractClassId.toString(),
          currentContractClassId: instance.currentContractClassId.toString(),
          initializationHash: instance.initializationHash?.toString() ?? null,
          deploymentParams,
          version: instance.version,
        };

        await storeContractInstance(newInstance);
        console.log(`Stored ${helper.name} instance at address: ${address}`);
        instancesStored++;
      }
    }
  }

  console.log(`Contract data loading complete. Artifacts: ${artifactsStored}, Instances: ${instancesStored}`);

  return {
    artifactsStored,
    instancesStored,
  };
}
