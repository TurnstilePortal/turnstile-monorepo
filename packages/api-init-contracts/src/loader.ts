import type { NewContractArtifact, NewContractInstance } from '@turnstile-portal/api-common/schema';
import { portalHelper, shieldGatewayHelper, tokenHelper } from './contracts/index.js';
import {
  getContractArtifactByHash,
  getContractInstanceByAddress,
  storeContractArtifact,
  storeContractInstance,
} from './db.js';
import { logger } from './utils/logger.js';

export async function loadTurnstileContracts(): Promise<{
  artifactsStored: number;
  instancesStored: number;
}> {
  logger.info('Loading Turnstile contract data...');

  const helpers = [portalHelper, shieldGatewayHelper, tokenHelper];

  let artifactsStored = 0;
  let instancesStored = 0;

  for (const helper of helpers) {
    logger.debug({ contract: helper.name }, 'Processing contract helper');

    // Load artifact
    const contractClass = await helper.getContractClass();
    const artifactHash = contractClass.artifactHash.toString();
    const contractClassId = contractClass.id.toString();

    logger.debug({ contract: helper.name, artifactHash, contractClassId }, 'Fetched contract class');

    const existingArtifact = await getContractArtifactByHash(artifactHash);
    if (existingArtifact) {
      logger.debug({ contract: helper.name, artifactHash }, 'Artifact already stored');
    } else {
      const newArtifact: NewContractArtifact = {
        artifactHash,
        artifact: await helper.getArtifact(),
        contractClassId,
      };

      await storeContractArtifact(newArtifact);
      logger.info({ contract: helper.name, artifactHash, contractClassId }, 'Stored contract artifact');
      artifactsStored++;
    }

    // Load instance if available
    if (helper.getContractInstance && helper.getDeploymentParams) {
      const instance = await helper.getContractInstance();
      const address = instance.address.toString();

      logger.debug({ contract: helper.name, address }, 'Fetched contract instance');

      const existingInstance = await getContractInstanceByAddress(address);
      if (existingInstance) {
        logger.debug({ contract: helper.name, address }, 'Contract instance already stored');
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
        logger.info({ contract: helper.name, address }, 'Stored contract instance');
        instancesStored++;
      }
    }
  }

  logger.info({ artifactsStored, instancesStored }, 'Contract data loading complete');

  return {
    artifactsStored,
    instancesStored,
  };
}
