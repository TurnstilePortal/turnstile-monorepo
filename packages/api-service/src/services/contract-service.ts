import { contractArtifacts, contractInstances, type DbClient } from '@turnstile-portal/api-common';
import { eq, or } from 'drizzle-orm';
import type { ContractArtifact, ContractInstance } from '../schemas/contracts.js';

type ContractInstanceRow = typeof contractInstances.$inferSelect;
type ContractArtifactRow = typeof contractArtifacts.$inferSelect;

export function convertDbContractInstanceToApi(
  dbInstance: ContractInstanceRow,
  includeArtifact?: boolean,
  artifact?: ContractArtifactRow,
): ContractInstance {
  const instance: ContractInstance = {
    id: dbInstance.id,
    address: dbInstance.address,
    original_contract_class_id: dbInstance.originalContractClassId,
    current_contract_class_id: dbInstance.currentContractClassId,
    initialization_hash: dbInstance.initializationHash,
    deployment_params: dbInstance.deploymentParams,
    version: dbInstance.version,
  };

  if (includeArtifact && artifact) {
    instance.artifact_hash = artifact.artifactHash;
    instance.artifact = artifact.artifact;
    instance.contract_class_id = artifact.contractClassId;
  }

  return instance;
}

export function convertDbArtifactToApi(dbArtifact: ContractArtifactRow): ContractArtifact {
  return {
    id: dbArtifact.id,
    artifact_hash: dbArtifact.artifactHash,
    artifact: dbArtifact.artifact,
    contract_class_id: dbArtifact.contractClassId,
  };
}

export class ContractService {
  constructor(private db: DbClient) {}

  async getContractInstance(address: string): Promise<ContractInstanceRow | null> {
    const result = await this.db
      .select()
      .from(contractInstances)
      .where(eq(contractInstances.address, address))
      .limit(1);

    return result[0] || null;
  }

  async getContractArtifactByInstance(instance: ContractInstanceRow): Promise<ContractArtifactRow | null> {
    if (!instance.currentContractClassId) {
      return null;
    }

    const result = await this.db
      .select()
      .from(contractArtifacts)
      .where(eq(contractArtifacts.contractClassId, instance.currentContractClassId))
      .limit(1);

    return result[0] || null;
  }

  async getContractArtifact(identifier: string): Promise<ContractArtifactRow | null> {
    const result = await this.db
      .select()
      .from(contractArtifacts)
      .where(or(eq(contractArtifacts.contractClassId, identifier), eq(contractArtifacts.artifactHash, identifier)))
      .limit(1);

    return result[0] || null;
  }

  async getContractInstancesByClassId(contractClassId: string): Promise<string[]> {
    const result = await this.db
      .select({ address: contractInstances.address })
      .from(contractInstances)
      .where(
        or(
          eq(contractInstances.originalContractClassId, contractClassId),
          eq(contractInstances.currentContractClassId, contractClassId),
        ),
      );

    return result.map((row) => row.address);
  }

  async testConnection(): Promise<ContractInstanceRow[]> {
    return this.db.select().from(contractInstances).limit(1);
  }
}
