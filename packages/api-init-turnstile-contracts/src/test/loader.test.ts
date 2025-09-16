import type { ContractClassWithId } from '@aztec/aztec.js';
import { Fr } from '@aztec/aztec.js';
import type { SerializableContractInstance } from '@aztec/stdlib/contract';
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
        id: Fr.fromString('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'),
        artifactHash: Fr.fromString('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'),
        artifact: { name: 'Portal', functions: [], outputs: {} },
        publicBytecodeCommitment: Fr.ZERO,
        privateFunctions: [],
        unconstrainedFunctions: [],
        privateFunctionsRoot: Fr.ZERO,
        packedBytecode: Buffer.from([]),
      };

      const mockShieldGatewayClass: ContractClassWithId = {
        id: Fr.fromString('0x2234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'),
        artifactHash: Fr.fromString('0xbbcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'),
        artifact: { name: 'ShieldGateway', functions: [], outputs: {} },
        publicBytecodeCommitment: Fr.ZERO,
        privateFunctions: [],
        unconstrainedFunctions: [],
        privateFunctionsRoot: Fr.ZERO,
        packedBytecode: Buffer.from([]),
      };

      const mockTokenClass: ContractClassWithId = {
        id: Fr.fromString('0x3234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'),
        artifactHash: Fr.fromString('0xcbcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'),
        artifact: { name: 'Token', functions: [], outputs: {} },
        publicBytecodeCommitment: Fr.ZERO,
        privateFunctions: [],
        unconstrainedFunctions: [],
        privateFunctionsRoot: Fr.ZERO,
        packedBytecode: Buffer.from([]),
      };

      vi.spyOn(util, 'getContractClasses').mockResolvedValue({
        portalContractClass: mockPortalClass,
        shieldGatewayContractClass: mockShieldGatewayClass,
        tokenContractClass: mockTokenClass,
      });

      const mockPortalInstance = {
        address: Fr.fromString('0x0001020304050607080900010203040506070809000102030405060708090001'),
        originalContractClassId: mockPortalClass.id,
        currentContractClassId: mockPortalClass.id,
        initializationHash: Fr.fromString('0x1111111111111111111111111111111111111111111111111111111111111111'),
        publicKeys: {
          masterIncomingViewingPublicKey: Fr.ZERO,
          masterOutgoingViewingPublicKey: Fr.ZERO,
          masterTaggingPublicKey: Fr.ZERO,
        },
        version: 1,
      } as SerializableContractInstance;

      const mockShieldGatewayInstance = {
        address: Fr.fromString('0x0001020304050607080900010203040506070809000102030405060708090002'),
        originalContractClassId: mockShieldGatewayClass.id,
        currentContractClassId: mockShieldGatewayClass.id,
        initializationHash: Fr.fromString('0x2222222222222222222222222222222222222222222222222222222222222222'),
        publicKeys: {
          masterIncomingViewingPublicKey: Fr.ZERO,
          masterOutgoingViewingPublicKey: Fr.ZERO,
          masterTaggingPublicKey: Fr.ZERO,
        },
        version: 1,
      } as SerializableContractInstance;

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
        id: Fr.fromString('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'),
        artifactHash: Fr.fromString('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'),
        artifact: { name: 'Portal', functions: [], outputs: {} },
        publicBytecodeCommitment: Fr.ZERO,
        privateFunctions: [],
        unconstrainedFunctions: [],
        privateFunctionsRoot: Fr.ZERO,
        packedBytecode: Buffer.from([]),
      };

      const mockShieldGatewayClass: ContractClassWithId = {
        id: Fr.fromString('0x2234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'),
        artifactHash: Fr.fromString('0xbbcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'),
        artifact: { name: 'ShieldGateway', functions: [], outputs: {} },
        publicBytecodeCommitment: Fr.ZERO,
        privateFunctions: [],
        unconstrainedFunctions: [],
        privateFunctionsRoot: Fr.ZERO,
        packedBytecode: Buffer.from([]),
      };

      const mockTokenClass: ContractClassWithId = {
        id: Fr.fromString('0x3234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'),
        artifactHash: Fr.fromString('0xcbcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'),
        artifact: { name: 'Token', functions: [], outputs: {} },
        publicBytecodeCommitment: Fr.ZERO,
        privateFunctions: [],
        unconstrainedFunctions: [],
        privateFunctionsRoot: Fr.ZERO,
        packedBytecode: Buffer.from([]),
      };

      await testDb.db.insert(contractArtifacts).values({
        artifactHash: mockPortalClass.artifactHash.toString(),
        artifact: mockPortalClass.artifact,
        contractClassId: mockPortalClass.id.toString(),
      });

      vi.spyOn(util, 'getContractClasses').mockResolvedValue({
        portalContractClass: mockPortalClass,
        shieldGatewayContractClass: mockShieldGatewayClass,
        tokenContractClass: mockTokenClass,
      });

      const mockPortalInstance = {
        address: Fr.fromString('0x0001020304050607080900010203040506070809000102030405060708090001'),
        originalContractClassId: mockPortalClass.id,
        currentContractClassId: mockPortalClass.id,
        initializationHash: Fr.fromString('0x1111111111111111111111111111111111111111111111111111111111111111'),
        publicKeys: {
          masterIncomingViewingPublicKey: Fr.ZERO,
          masterOutgoingViewingPublicKey: Fr.ZERO,
          masterTaggingPublicKey: Fr.ZERO,
        },
        version: 1,
      } as SerializableContractInstance;

      const mockShieldGatewayInstance = {
        address: Fr.fromString('0x0001020304050607080900010203040506070809000102030405060708090002'),
        originalContractClassId: mockShieldGatewayClass.id,
        currentContractClassId: mockShieldGatewayClass.id,
        initializationHash: Fr.fromString('0x2222222222222222222222222222222222222222222222222222222222222222'),
        publicKeys: {
          masterIncomingViewingPublicKey: Fr.ZERO,
          masterOutgoingViewingPublicKey: Fr.ZERO,
          masterTaggingPublicKey: Fr.ZERO,
        },
        version: 1,
      } as SerializableContractInstance;

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
