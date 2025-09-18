import type { ContractClassWithId } from '@aztec/aztec.js';
import { Fr } from '@aztec/aztec.js';
import { randomContractArtifact, randomContractInstanceWithAddress } from '@aztec/stdlib/testing';
import { contractArtifacts, contractInstances } from '@turnstile-portal/api-common/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setDatabase } from '../db.js';
import { loadTurnstileContracts } from '../loader.js';
import * as util from '../util.js';
import { setupTestDatabase } from './setup.js';

describe('loader', () => {
  let testDb: Awaited<ReturnType<typeof setupTestDatabase>>;

  beforeEach(async () => {
    testDb = await setupTestDatabase();
    setDatabase(testDb.db);
  });

  afterEach(async () => {
    await testDb.cleanup();
    setDatabase(null);
  });

  describe('loadTurnstileContracts', () => {
    it('should load contract artifacts and instances', async () => {
      const mockPortalClass: ContractClassWithId = {
        id: Fr.random(),
        artifactHash: Fr.random(),
      } as unknown as ContractClassWithId;

      const mockShieldGatewayClass: ContractClassWithId = {
        id: Fr.random(),
        artifactHash: Fr.random(),
      } as unknown as ContractClassWithId;

      const mockTokenClass: ContractClassWithId = {
        id: Fr.random(),
        artifactHash: Fr.random(),
      } as unknown as ContractClassWithId;

      vi.spyOn(util, 'getContractClasses').mockResolvedValue({
        portalContractClass: mockPortalClass,
        shieldGatewayContractClass: mockShieldGatewayClass,
        tokenContractClass: mockTokenClass,
      });

      const mockPortalInstanceBase = await randomContractInstanceWithAddress();
      const mockPortalInstance = {
        ...mockPortalInstanceBase,
        originalContractClassId: mockPortalClass.id,
        currentContractClassId: mockPortalClass.id,
        version: 1 as const,
      };

      const mockShieldGatewayInstanceBase = await randomContractInstanceWithAddress();
      const mockShieldGatewayInstance = {
        ...mockShieldGatewayInstanceBase,
        originalContractClassId: mockShieldGatewayClass.id,
        currentContractClassId: mockShieldGatewayClass.id,
        version: 1 as const,
      };

      vi.spyOn(util, 'getContractInstances').mockResolvedValue({
        portalInstance: mockPortalInstance,
        shieldGatewayInstance: mockShieldGatewayInstance,
      });

      const result = await loadTurnstileContracts();

      expect(result.artifactsStored).toBe(3);
      expect(result.instancesStored).toBe(2);

      const artifacts = await testDb.db.select().from(contractArtifacts);
      expect(artifacts).toHaveLength(3);

      const instances = await testDb.db.select().from(contractInstances);
      expect(instances).toHaveLength(2);

      const portalArtifact = artifacts.find((a) => a.artifactHash === mockPortalClass.artifactHash.toString());
      expect(portalArtifact).toBeDefined();
      expect(portalArtifact?.contractClassId).toBe(mockPortalClass.id.toString());

      const portalInstance = instances.find((i) => i.address === mockPortalInstance.address.toString());
      expect(portalInstance).toBeDefined();
      expect(portalInstance?.originalContractClassId).toBe(mockPortalClass.id.toString());
      expect(portalInstance?.version).toBe(1);
    });

    it('should skip existing artifacts and instances', async () => {
      const mockPortalClass: ContractClassWithId = {
        id: Fr.random(),
        artifactHash: Fr.random(),
      } as unknown as ContractClassWithId;

      const mockShieldGatewayClass: ContractClassWithId = {
        id: Fr.random(),
        artifactHash: Fr.random(),
      } as unknown as ContractClassWithId;

      const mockTokenClass: ContractClassWithId = {
        id: Fr.random(),
        artifactHash: Fr.random(),
      } as unknown as ContractClassWithId;

      await testDb.db.insert(contractArtifacts).values({
        artifactHash: mockPortalClass.artifactHash.toString(),
        artifact: await randomContractArtifact(),
        contractClassId: mockPortalClass.id.toString(),
      });

      vi.spyOn(util, 'getContractClasses').mockResolvedValue({
        portalContractClass: mockPortalClass,
        shieldGatewayContractClass: mockShieldGatewayClass,
        tokenContractClass: mockTokenClass,
      });

      const mockPortalInstanceBase = await randomContractInstanceWithAddress();
      const mockPortalInstance = {
        ...mockPortalInstanceBase,
        originalContractClassId: mockPortalClass.id,
        currentContractClassId: mockPortalClass.id,
        version: 1 as const,
      };

      const mockShieldGatewayInstanceBase = await randomContractInstanceWithAddress();
      const mockShieldGatewayInstance = {
        ...mockShieldGatewayInstanceBase,
        originalContractClassId: mockShieldGatewayClass.id,
        currentContractClassId: mockShieldGatewayClass.id,
        version: 1 as const,
      };

      await testDb.db.insert(contractInstances).values({
        address: mockPortalInstance.address.toString(),
        originalContractClassId: mockPortalClass.id.toString(),
        currentContractClassId: mockPortalClass.id.toString(),
        initializationHash: mockPortalInstance.initializationHash?.toString() ?? null,
        deploymentParams: { publicKeys: mockPortalInstance.publicKeys },
        version: 1,
      });

      vi.spyOn(util, 'getContractInstances').mockResolvedValue({
        portalInstance: mockPortalInstance,
        shieldGatewayInstance: mockShieldGatewayInstance,
      });

      const result = await loadTurnstileContracts();

      expect(result.artifactsStored).toBe(2);
      expect(result.instancesStored).toBe(1);

      const artifacts = await testDb.db.select().from(contractArtifacts);
      expect(artifacts).toHaveLength(3);

      const instances = await testDb.db.select().from(contractInstances);
      expect(instances).toHaveLength(2);
    });
  });
});
