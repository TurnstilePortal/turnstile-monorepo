import type { NewContractArtifact, NewContractInstance } from '@turnstile-portal/api-common/schema';
import { contractArtifacts, contractInstances } from '@turnstile-portal/api-common/schema';
import { TokenContractArtifact } from '@turnstile-portal/aztec-artifacts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getContractArtifactByHash,
  getContractInstanceByAddress,
  getDatabase,
  setDatabase,
  storeContractArtifact,
  storeContractInstance,
} from '../db.js';
import { stripArtifact } from '../strip-artifact.js';
import { setupTestDatabase } from './setup.js';

function expectDefined<T>(value: T | null | undefined): asserts value is T {
  expect(value).toBeDefined();
}

function buildSanitizedTokenArtifact() {
  return stripArtifact(TokenContractArtifact);
}

function createNewArtifact({
  artifactHash,
  contractClassId,
  artifact,
}: {
  artifactHash: string;
  contractClassId: string;
  artifact?: ReturnType<typeof buildSanitizedTokenArtifact>;
}): NewContractArtifact {
  return {
    artifactHash,
    artifact: artifact ?? buildSanitizedTokenArtifact(),
    contractClassId,
  };
}

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
      const artifact = createNewArtifact({
        artifactHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        contractClassId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      });

      await storeContractArtifact({ ...artifact });

      const stored = await testDb.db.select().from(contractArtifacts);
      expect(stored).toHaveLength(1);
      const storedArtifact = stored[0];
      expectDefined(storedArtifact);
      expect(storedArtifact.artifactHash).toBe(artifact.artifactHash);
      expect(storedArtifact.contractClassId).toBe(artifact.contractClassId);
      const storedContractArtifact = storedArtifact.artifact as { fileMap?: Record<string, unknown> };
      expect(Object.keys(storedContractArtifact.fileMap ?? {})).toHaveLength(0);
    });

    it('should strip debug symbols before persisting artifacts', async () => {
      const contractArtifact = TokenContractArtifact;
      const artifact = createNewArtifact({
        artifactHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        contractClassId: '0x2222222222222222222222222222222222222222222222222222222222222222',
        artifact: contractArtifact,
      });

      await storeContractArtifact({ ...artifact });

      const stored = await testDb.db.select().from(contractArtifacts);
      expect(stored).toHaveLength(1);
      const storedArtifact = stored[0];
      expectDefined(storedArtifact);
      const storedArtifactData = storedArtifact.artifact as {
        fileMap?: Record<string, unknown>;
        functions?: Array<{ debugSymbols?: string; debug?: unknown }>;
      };
      expect(storedArtifactData.functions?.every((fn) => fn.debugSymbols === '')).toBe(true);
      expect(Object.keys(storedArtifactData.fileMap ?? {})).toHaveLength(0);
      expect(contractArtifact.functions.some((fn) => fn.debugSymbols.length > 0)).toBe(true);
    });

    it('should update existing artifact on conflict', async () => {
      const artifact = createNewArtifact({
        artifactHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        contractClassId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      });

      await storeContractArtifact(artifact);

      const updatedArtifact = createNewArtifact({
        artifactHash: artifact.artifactHash,
        contractClassId: '0x9999567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        artifact: { ...buildSanitizedTokenArtifact(), name: 'UpdatedContract' },
      });

      await storeContractArtifact(updatedArtifact);

      const stored = await testDb.db.select().from(contractArtifacts);
      expect(stored).toHaveLength(1);
      const storedArtifact = stored[0];
      expectDefined(storedArtifact);
      const storedArtifactData = storedArtifact.artifact as {
        name?: string;
        fileMap?: Record<string, unknown>;
        functions?: Array<{ debugSymbols?: string; debug?: unknown }>;
      };
      expect(storedArtifactData.name).toBe('UpdatedContract');
      expect(storedArtifactData.functions?.every((fn) => fn.debugSymbols === '')).toBe(true);
      expect(Object.keys(storedArtifactData.fileMap ?? {})).toHaveLength(0);
      expect(storedArtifact.contractClassId).toBe(updatedArtifact.contractClassId);
    });
  });

  describe('storeContractInstance', () => {
    it('should store a new contract instance', async () => {
      const artifact = createNewArtifact({
        artifactHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        contractClassId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      });

      await storeContractArtifact(artifact);

      const instance: NewContractInstance = {
        address: '0x0001020304050607080900010203040506070809000102030405060708090001',
        originalContractClassId: artifact.contractClassId,
        currentContractClassId: artifact.contractClassId,
        initializationHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        deploymentParams: {
          constructorArtifact: 'constructor',
          constructorArgs: [],
          salt: '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`,
          publicKeys: '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`,
          deployer: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        },
        version: 1,
      };

      await storeContractInstance(instance);

      const stored = await testDb.db.select().from(contractInstances);
      expect(stored).toHaveLength(1);
      const storedInstance = stored[0];
      expectDefined(storedInstance);
      expect(storedInstance.address).toBe(instance.address);
      expect(storedInstance.version).toBe(1);
    });

    it('should update existing instance on conflict', async () => {
      const artifact = createNewArtifact({
        artifactHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        contractClassId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      });

      await storeContractArtifact(artifact);

      const instance: NewContractInstance = {
        address: '0x0001020304050607080900010203040506070809000102030405060708090001',
        originalContractClassId: artifact.contractClassId,
        currentContractClassId: artifact.contractClassId,
        initializationHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        deploymentParams: {
          constructorArtifact: 'constructor',
          constructorArgs: [],
          salt: '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`,
          publicKeys: '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`,
          deployer: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        },
        version: 1,
      };

      await storeContractInstance(instance);

      const newArtifact = createNewArtifact({
        artifactHash: '0xfffdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        contractClassId: '0xfffdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        artifact: { ...buildSanitizedTokenArtifact(), name: 'UpdatedContract' },
      });

      await storeContractArtifact(newArtifact);

      const updatedInstance: NewContractInstance = {
        ...instance,
        currentContractClassId: '0xfffdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        version: 2,
      };

      await storeContractInstance(updatedInstance);

      const stored = await testDb.db.select().from(contractInstances);
      expect(stored).toHaveLength(1);
      const storedInstance = stored[0];
      expectDefined(storedInstance);
      expect(storedInstance.currentContractClassId).toBe(updatedInstance.currentContractClassId);
      expect(storedInstance.version).toBe(2);
    });

    it('should store contract instance without constructor fields', async () => {
      const artifact = createNewArtifact({
        artifactHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        contractClassId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      });

      await storeContractArtifact(artifact);

      const instance: NewContractInstance = {
        address: '0x0001020304050607080900010203040506070809000102030405060708090002',
        originalContractClassId: artifact.contractClassId,
        currentContractClassId: artifact.contractClassId,
        initializationHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        deploymentParams: {
          // No constructor fields for contracts that don't need them
          salt: '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`,
          publicKeys: '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`,
          deployer: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        },
        version: 1,
      };

      await storeContractInstance(instance);

      const stored = await testDb.db.select().from(contractInstances);
      expect(stored).toHaveLength(1);
      const storedInstance = stored[0];
      expectDefined(storedInstance);
      expect(storedInstance.address).toBe(instance.address);
      expect(storedInstance.deploymentParams).toEqual(instance.deploymentParams);
      expect(storedInstance.version).toBe(1);
    });
  });

  describe('getContractArtifactByHash', () => {
    it('should retrieve artifact by hash', async () => {
      const artifact = createNewArtifact({
        artifactHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        contractClassId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      });

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
      const artifact = createNewArtifact({
        artifactHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        contractClassId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      });

      await storeContractArtifact(artifact);

      const instance: NewContractInstance = {
        address: '0x0001020304050607080900010203040506070809000102030405060708090001',
        originalContractClassId: artifact.contractClassId,
        currentContractClassId: artifact.contractClassId,
        initializationHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        deploymentParams: {
          constructorArtifact: 'constructor',
          constructorArgs: [],
          salt: '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`,
          publicKeys: '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`,
          deployer: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        },
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
