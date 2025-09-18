/** biome-ignore-all lint/suspicious/noExplicitAny: tests */
import { AztecAddress } from '@aztec/aztec.js';
import type { NewContractInstance } from '@turnstile-portal/api-common/schema';
import { L2_CONTRACT_DEPLOYMENT_SALT } from '@turnstile-portal/turnstile.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbClient } from '../db.js';
import {
  getContractInstanceByAddress,
  getOrCreateTokenContractArtifact,
  setDatabase,
  storeContractInstance,
} from '../db.js';
import { ContractRegistryService, type TokenMetadata } from '../services/contract-registry.js';

// Mock the Aztec dependencies
vi.mock('@aztec/aztec.js', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    AztecAddress: {
      fromString: vi.fn((addr: string) => ({ toString: () => addr, equals: vi.fn() })),
      ZERO: { toString: () => '0x0000000000000000000000000000000000000000000000000000000000000000' },
    },
    getContractClassFromArtifact: vi.fn(),
    getContractInstanceFromDeployParams: vi.fn(),
  };
});

vi.mock('@aztec/stdlib/keys', () => ({
  PublicKeys: {
    default: vi.fn(() => ({
      mockPublicKeys: true,
      toString: () => '0x1234567890123456789012345678901234567890123456789012345678901234',
    })),
  },
}));

vi.mock('@turnstile-portal/aztec-artifacts', () => ({
  TokenContractArtifact: { mockArtifact: true },
}));

// Mock the database functions
vi.mock('../db.js', async () => {
  const actual = await vi.importActual('../db.js');
  return {
    ...actual,
    getContractInstanceByAddress: vi.fn(),
    getOrCreateTokenContractArtifact: vi.fn(),
    storeContractInstance: vi.fn(),
  };
});

describe('ContractRegistryService', () => {
  let service: ContractRegistryService;

  const mockTokenMetadata: TokenMetadata = {
    name: 'Test Token',
    symbol: 'TEST',
    decimals: 18,
  };

  const mockTokenAddress = AztecAddress.fromString(
    '0x1234567890123456789012345678901234567890123456789012345678901234',
  );
  const mockPortalAddress = AztecAddress.fromString(
    '0x9876543210987654321098765432109876543210987654321098765432109876',
  );

  beforeEach(async () => {
    vi.clearAllMocks();

    setDatabase({} as DbClient);
    service = new ContractRegistryService();

    // Setup default mocks
    const { getContractClassFromArtifact, getContractInstanceFromDeployParams } = await import('@aztec/aztec.js');

    vi.mocked(getContractClassFromArtifact).mockResolvedValue({
      id: { toString: () => 'mock-contract-class-id' },
      artifactHash: { toString: () => 'mock-artifact-hash' },
    } as any);

    vi.mocked(getContractInstanceFromDeployParams).mockResolvedValue({
      address: mockTokenAddress,
      initializationHash: { toString: () => 'mock-init-hash' },
      version: 1,
    } as any);

    // Setup mock for address equality check
    vi.mocked(mockTokenAddress.equals).mockReturnValue(true);
  });

  describe('storeTokenInstance', () => {
    it('should skip if contract instance already exists', async () => {
      vi.mocked(getContractInstanceByAddress).mockResolvedValue({
        id: 1,
        address: mockTokenAddress.toString(),
        originalContractClassId: 'mock-class-id',
        currentContractClassId: 'mock-class-id',
        initializationHash: 'mock-init-hash',
        deploymentParams: {
          constructorArtifact: 'constructor_with_minter',
          constructorArgs: [],
          salt: '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`,
          publicKeys: '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`,
          deployer: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.storeTokenInstance(mockTokenAddress, mockPortalAddress, mockTokenMetadata);

      expect(vi.mocked(getContractInstanceByAddress)).toHaveBeenCalledWith(mockTokenAddress.toString());
      expect(vi.mocked(getOrCreateTokenContractArtifact)).not.toHaveBeenCalled();
      expect(vi.mocked(storeContractInstance)).not.toHaveBeenCalled();
    });

    it('should store new contract instance successfully', async () => {
      vi.mocked(getContractInstanceByAddress).mockResolvedValue(null);

      await service.storeTokenInstance(mockTokenAddress, mockPortalAddress, mockTokenMetadata);

      expect(vi.mocked(getContractInstanceByAddress)).toHaveBeenCalledWith(mockTokenAddress.toString());
      expect(vi.mocked(getOrCreateTokenContractArtifact)).toHaveBeenCalledWith(
        'mock-artifact-hash',
        'mock-contract-class-id',
        { mockArtifact: true },
      );

      expect(vi.mocked(storeContractInstance)).toHaveBeenCalledWith({
        address: mockTokenAddress.toString(),
        originalContractClassId: 'mock-contract-class-id',
        currentContractClassId: 'mock-contract-class-id',
        initializationHash: 'mock-init-hash',
        deploymentParams: {
          constructorArtifact: 'constructor_with_minter',
          constructorArgs: ['Test Token', 'TEST', 18, mockPortalAddress.toString(), AztecAddress.ZERO.toString()],
          salt: L2_CONTRACT_DEPLOYMENT_SALT.toString() as `0x${string}`,
          deployer: AztecAddress.ZERO.toString() as `0x${string}`,
          publicKeys: expect.any(String) as `0x${string}`,
        },
        version: 1,
      } as NewContractInstance);
    });

    it('should warn and skip if calculated address does not match expected address', async () => {
      vi.mocked(getContractInstanceByAddress).mockResolvedValue(null);

      const differentAddress = AztecAddress.fromString(
        '0x1111111111111111111111111111111111111111111111111111111111111111',
      );

      const { getContractInstanceFromDeployParams } = await import('@aztec/aztec.js');
      vi.mocked(getContractInstanceFromDeployParams).mockResolvedValue({
        address: differentAddress,
        initializationHash: { toString: () => 'mock-init-hash' },
        version: 1,
      } as any);

      vi.mocked(mockTokenAddress.equals).mockReturnValue(false);

      await service.storeTokenInstance(mockTokenAddress, mockPortalAddress, mockTokenMetadata);

      expect(vi.mocked(storeContractInstance)).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(getContractInstanceByAddress).mockRejectedValue(new Error('Database error'));

      await expect(service.storeTokenInstance(mockTokenAddress, mockPortalAddress, mockTokenMetadata)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('contract class caching', () => {
    it('should cache contract class ID between calls', async () => {
      vi.mocked(getContractInstanceByAddress).mockResolvedValue(null);

      const { getContractClassFromArtifact } = await import('@aztec/aztec.js');

      // First call
      await service.storeTokenInstance(mockTokenAddress, mockPortalAddress, mockTokenMetadata);

      // Second call
      await service.storeTokenInstance(mockTokenAddress, mockPortalAddress, mockTokenMetadata);

      // getContractClassFromArtifact should only be called once due to caching
      expect(getContractClassFromArtifact).toHaveBeenCalledTimes(1);
    });
  });

  describe('deployment parameters', () => {
    it('should create deployment parameters with correct constructor arguments', async () => {
      vi.mocked(getContractInstanceByAddress).mockResolvedValue(null);

      const { getContractInstanceFromDeployParams } = await import('@aztec/aztec.js');

      await service.storeTokenInstance(mockTokenAddress, mockPortalAddress, mockTokenMetadata);

      expect(getContractInstanceFromDeployParams).toHaveBeenCalledWith(
        { mockArtifact: true },
        expect.objectContaining({
          constructorArtifact: 'constructor_with_minter',
          constructorArgs: [
            'Test Token',
            'TEST',
            18,
            mockPortalAddress,
            expect.objectContaining({ toString: expect.any(Function) }), // AztecAddress.ZERO
          ],
          deployer: expect.objectContaining({ toString: expect.any(Function) }), // AztecAddress.ZERO
          publicKeys: { mockPublicKeys: true },
        }),
      );
    });
  });
});
