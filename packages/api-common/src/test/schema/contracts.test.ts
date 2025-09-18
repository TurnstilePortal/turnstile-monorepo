import { describe, expect, it } from 'vitest';
import {
  type ContractArtifact,
  type ContractInstance,
  contractArtifacts,
  contractInstances,
  type NewContractArtifact,
  type NewContractInstance,
} from '../../schema/contracts.js';

const hex = (char: string) => `0x${char.repeat(64)}`;

describe('contract schema', () => {
  describe('contract_artifacts table', () => {
    it('defines required columns', () => {
      expect(contractArtifacts.id).toBeDefined();
      expect(contractArtifacts.artifactHash).toBeDefined();
      expect(contractArtifacts.artifact).toBeDefined();
      expect(contractArtifacts.contractClassId).toBeDefined();
      expect(contractArtifacts.createdAt).toBeDefined();
      expect(contractArtifacts.updatedAt).toBeDefined();
    });

    it('uses expected column names', () => {
      expect(contractArtifacts.artifactHash.name).toBe('artifact_hash');
      expect(contractArtifacts.contractClassId.name).toBe('contract_class_id');
    });

    it('provides ContractArtifact types', () => {
      const artifact: ContractArtifact = {
        id: 1,
        artifactHash: hex('a'),
        artifact: { bytecode: '0x1234' },
        contractClassId: hex('b'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(artifact.contractClassId).toMatch(/^0x/);
    });

    it('provides NewContractArtifact insert types', () => {
      const artifact: NewContractArtifact = {
        artifactHash: hex('c'),
        artifact: { version: 1 },
        contractClassId: hex('d'),
      };

      expect(artifact.artifact).toMatchObject({ version: 1 });
    });
  });

  describe('contract_instances table', () => {
    it('defines required columns', () => {
      expect(contractInstances.id).toBeDefined();
      expect(contractInstances.address).toBeDefined();
      expect(contractInstances.originalContractClassId).toBeDefined();
      expect(contractInstances.currentContractClassId).toBeDefined();
      expect(contractInstances.initializationHash).toBeDefined();
      expect(contractInstances.deploymentParams).toBeDefined();
      expect(contractInstances.version).toBeDefined();
      expect(contractInstances.createdAt).toBeDefined();
      expect(contractInstances.updatedAt).toBeDefined();
    });

    it('uses expected column names', () => {
      expect(contractInstances.address.name).toBe('address');
      expect(contractInstances.originalContractClassId.name).toBe('original_contract_class_id');
      expect(contractInstances.currentContractClassId.name).toBe('current_contract_class_id');
      expect(contractInstances.initializationHash.name).toBe('initialization_hash');
    });

    it('provides ContractInstance types', () => {
      const instance: ContractInstance = {
        id: 1,
        address: hex('1'),
        originalContractClassId: hex('2'),
        currentContractClassId: hex('3'),
        initializationHash: hex('4'),
        deploymentParams: {
          constructor_name: 'constructor',
          constructor_args: [],
          deployer: hex('5'),
          salt: hex('6'),
          publicKeys: {
            master_nullifier_public_key: hex('7'),
            master_incoming_view_public_key: hex('8'),
            master_outgoing_viewing_public_key: hex('9'),
            master_tagging_public_key: hex('a'),
          },
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(instance.deploymentParams?.constructor_name).toBe('constructor');
    });

    it('provides NewContractInstance insert types with optional fields', () => {
      const instance: NewContractInstance = {
        address: hex('c'),
        version: 1,
      };

      expect(instance.address).toMatch(/^0x/);
      expect(instance.originalContractClassId).toBeUndefined();
    });
  });
});
