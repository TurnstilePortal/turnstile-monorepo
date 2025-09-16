import type { NewContractArtifact, NewContractInstance } from '@turnstile-portal/api-common/schema';
import { contractArtifacts, contractInstances } from '@turnstile-portal/api-common/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getContractArtifactByHash,
  getContractInstanceByAddress,
  getDatabase,
  setDatabase,
  storeContractArtifact,
  storeContractInstance,
} from '../db.js';
import { setupTestDatabase } from './setup.js';

describe('db', () => {
  let testDb: Awaited<ReturnType<typeof setupTestDatabase>>;

  beforeEach(async () => {
    testDb = await setupTestDatabase();
    setDatabase(testDb.db);
  });

  afterEach(async () => {
    await testDb.cleanup();
    setDatabase(null);
  });

  describe('getDatabase', () => {
    it('should throw error when DATABASE_URL is not set', () => {
      setDatabase(null);
      const originalEnv = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;

      expect(() => getDatabase()).toThrow('DATABASE_URL environment variable is not set');

      process.env.DATABASE_URL = originalEnv;
    });
  });

  describe('storeContractArtifact', () => {
    it('should store a new contract artifact', async () => {
      const artifact: NewContractArtifact = {
        artifactHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        artifact: { name: 'TestContract', functions: [], outputs: {} },
        contractClassId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      };

      await storeContractArtifact(artifact);

      const stored = await testDb.db.select().from(contractArtifacts);
      expect(stored).toHaveLength(1);
      expect(stored[0].artifactHash).toBe(artifact.artifactHash);
      expect(stored[0].contractClassId).toBe(artifact.contractClassId);
    });

    it('should update existing artifact on conflict', async () => {
      const artifact: NewContractArtifact = {
        artifactHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        artifact: { name: 'TestContract', functions: [], outputs: {} },
        contractClassId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      };

      await storeContractArtifact(artifact);

      const updatedArtifact: NewContractArtifact = {
        artifactHash: artifact.artifactHash,
        artifact: { name: 'UpdatedContract', functions: [], outputs: {} },
        contractClassId: '0x9999567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      };

      await storeContractArtifact(updatedArtifact);

      const stored = await testDb.db.select().from(contractArtifacts);
      expect(stored).toHaveLength(1);
      expect(stored[0].artifact).toEqual(updatedArtifact.artifact);
      expect(stored[0].contractClassId).toBe(updatedArtifact.contractClassId);
    });
  });

  describe('storeContractInstance', () => {
    it('should store a new contract instance', async () => {
      const artifact: NewContractArtifact = {
        artifactHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        artifact: { name: 'TestContract', functions: [], outputs: {} },
        contractClassId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      };

      await storeContractArtifact(artifact);

      const instance: NewContractInstance = {
        address: '0x0001020304050607080900010203040506070809000102030405060708090001',
        originalContractClassId: artifact.artifactHash,
        currentContractClassId: artifact.artifactHash,
        initializationHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        deploymentParams: { key: 'value' },
        version: 1,
      };

      await storeContractInstance(instance);

      const stored = await testDb.db.select().from(contractInstances);
      expect(stored).toHaveLength(1);
      expect(stored[0].address).toBe(instance.address);
      expect(stored[0].version).toBe(1);
    });

    it('should update existing instance on conflict', async () => {
      const artifact: NewContractArtifact = {
        artifactHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        artifact: { name: 'TestContract', functions: [], outputs: {} },
        contractClassId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      };

      await storeContractArtifact(artifact);

      const instance: NewContractInstance = {
        address: '0x0001020304050607080900010203040506070809000102030405060708090001',
        originalContractClassId: artifact.artifactHash,
        currentContractClassId: artifact.artifactHash,
        initializationHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        deploymentParams: { key: 'value' },
        version: 1,
      };

      await storeContractInstance(instance);

      const updatedInstance: NewContractInstance = {
        ...instance,
        currentContractClassId: '0xfffdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        version: 2,
      };

      await storeContractInstance(updatedInstance);

      const stored = await testDb.db.select().from(contractInstances);
      expect(stored).toHaveLength(1);
      expect(stored[0].currentContractClassId).toBe(updatedInstance.currentContractClassId);
      expect(stored[0].version).toBe(2);
    });
  });

  describe('getContractArtifactByHash', () => {
    it('should retrieve artifact by hash', async () => {
      const artifact: NewContractArtifact = {
        artifactHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        artifact: { name: 'TestContract', functions: [], outputs: {} },
        contractClassId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      };

      await storeContractArtifact(artifact);

      const retrieved = await getContractArtifactByHash(artifact.artifactHash);
      expect(retrieved).toBeDefined();
      expect(retrieved?.artifactHash).toBe(artifact.artifactHash);
    });

    it('should return null for non-existent artifact', async () => {
      const retrieved = await getContractArtifactByHash('0xnonexistent');
      expect(retrieved).toBeNull();
    });
  });

  describe('getContractInstanceByAddress', () => {
    it('should retrieve instance by address', async () => {
      const artifact: NewContractArtifact = {
        artifactHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        artifact: { name: 'TestContract', functions: [], outputs: {} },
        contractClassId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      };

      await storeContractArtifact(artifact);

      const instance: NewContractInstance = {
        address: '0x0001020304050607080900010203040506070809000102030405060708090001',
        originalContractClassId: artifact.artifactHash,
        currentContractClassId: artifact.artifactHash,
        initializationHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        deploymentParams: { key: 'value' },
        version: 1,
      };

      await storeContractInstance(instance);

      const retrieved = await getContractInstanceByAddress(instance.address);
      expect(retrieved).toBeDefined();
      expect(retrieved?.address).toBe(instance.address);
    });

    it('should return null for non-existent instance', async () => {
      const retrieved = await getContractInstanceByAddress('0xnonexistent');
      expect(retrieved).toBeNull();
    });
  });
});
