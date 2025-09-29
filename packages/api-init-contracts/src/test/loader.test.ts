import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContractArtifact, ContractInstanceWithAddress } from '@aztec/aztec.js';
import { getContractClassFromArtifact } from '@aztec/stdlib/contract';
import type { AztecArtifactsApiClient } from '@aztec-artifacts/client';
import { NotFoundError } from '@aztec-artifacts/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as util from '../factory.js';
import { loadTurnstileContracts } from '../loader.js';

// Load test deployment data
const testDeploymentData = JSON.parse(readFileSync(join(__dirname, 'deployment.json'), 'utf-8'));

describe('loader', () => {
  let mockClient: AztecArtifactsApiClient;
  const storedArtifacts = new Set<string>();
  const storedInstances = new Set<string>();

  beforeEach(async () => {
    // Set test deployment data to avoid network calls
    util.setDeploymentData(testDeploymentData);

    // Clear stored data
    storedArtifacts.clear();
    storedInstances.clear();

    // Create mock client
    mockClient = {
      getArtifact: vi.fn(async (artifactHash: string) => {
        // Return artifact if it was previously stored
        if (storedArtifacts.has(artifactHash)) {
          return {} as ContractArtifact; // Mock artifact
        }
        throw new NotFoundError(`Artifact ${artifactHash} not found`);
      }),
      getContract: vi.fn(async (address: string) => {
        // Return instance if it was previously stored
        if (storedInstances.has(address)) {
          return {
            instance: {} as ContractInstanceWithAddress,
          };
        }
        throw new NotFoundError(`Contract instance at ${address} not found`);
      }),
      uploadContractArtifact: vi.fn(async (artifact: ContractArtifact) => {
        // Simulate storing the artifact
        const contractClass = await getContractClassFromArtifact(artifact);
        const artifactHash = contractClass.artifactHash.toString();
        storedArtifacts.add(artifactHash);
        return { contractClassId: contractClass.id.toString() };
      }),
      uploadContractInstance: vi.fn(async ({ instance }: { instance: ContractInstanceWithAddress }) => {
        // Simulate storing the instance
        const address = instance.address.toString();
        storedInstances.add(address);
        return { address, contractClassId: instance.currentContractClassId.toString() };
      }),
    } as unknown as AztecArtifactsApiClient;
  });

  afterEach(async () => {
    // Reset factory to clean state
    util.resetFactory();
  });

  describe('loadTurnstileContracts', () => {
    it('should load contract artifacts and instances', async () => {
      const result = await loadTurnstileContracts(mockClient);

      expect(result.artifactsStored, 'artifactsStored').toBe(3);
      expect(result.instancesStored, 'instancesStored').toBe(2);

      // Verify that upload methods were called
      expect(mockClient.uploadContractArtifact).toHaveBeenCalledTimes(3);
      expect(mockClient.uploadContractInstance).toHaveBeenCalledTimes(2);

      // Verify that artifacts and instances were stored in our mock
      expect(storedArtifacts.size).toBe(3);
      expect(storedInstances.size).toBe(2);
    });

    it('should skip existing artifacts and instances', async () => {
      // First run to load all data
      const firstResult = await loadTurnstileContracts(mockClient);
      expect(firstResult.artifactsStored).toBe(3);
      expect(firstResult.instancesStored).toBe(2);

      // Reset mock call counts
      vi.clearAllMocks();

      // Second run should skip existing data
      const secondResult = await loadTurnstileContracts(mockClient);
      expect(secondResult.artifactsStored).toBe(0);
      expect(secondResult.instancesStored).toBe(0);

      // Verify that upload methods were not called again
      expect(mockClient.uploadContractArtifact).not.toHaveBeenCalled();
      expect(mockClient.uploadContractInstance).not.toHaveBeenCalled();

      // Verify that getArtifact and getContract were called to check existence
      expect(mockClient.getArtifact).toHaveBeenCalledTimes(3);
      expect(mockClient.getContract).toHaveBeenCalledTimes(2);

      // Total stored should still be the same
      expect(storedArtifacts.size).toBe(3);
      expect(storedInstances.size).toBe(2);
    });
  });
});
