import { type AztecArtifactsApiClient, NotFoundError } from '@aztec-artifacts/client';
import { portalHelper, shieldGatewayHelper, tokenHelper } from './contracts/index.js';
import { logger } from './utils/logger.js';

export async function loadTurnstileContracts(client: AztecArtifactsApiClient): Promise<{
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

    try {
      await client.getArtifact(artifactHash);
      logger.debug({ contract: helper.name, artifactHash }, 'Artifact already stored');
    } catch (error) {
      if (!(error instanceof NotFoundError)) {
        throw error;
      }
      console.log(`Uploading artifact for ${helper.name}...`);
      await client.uploadContractArtifact(await helper.getArtifact());
      logger.info({ contract: helper.name, artifactHash, contractClassId }, 'Stored contract artifact');
      artifactsStored++;
    }

    // Load instance if available
    if (helper.getContractInstance && helper.getInitializationData) {
      const instance = await helper.getContractInstance();
      const address = instance.address.toString();

      logger.debug({ contract: helper.name, address }, 'Fetched contract instance');

      try {
        await client.getContract(address);
        logger.debug({ contract: helper.name, address }, 'Contract instance already stored');
      } catch (error) {
        if (!(error instanceof NotFoundError)) {
          throw error;
        }
        const initializationData = await helper.getInitializationData();
        await client.uploadContractInstance({ instance, initializationData });
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
