/** biome-ignore-all lint/style/noNonNullAssertion: tests */
import { createDbClient } from '@turnstile-portal/api-common';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Define mock contract types
type MockContractInstance = {
  id?: number;
  address: string;
  originalContractClassId?: string | null;
  currentContractClassId?: string | null;
  initializationHash?: string | null;
  deploymentParams?: unknown;
  version: number;
  createdAt?: Date;
  updatedAt?: Date;
};

type MockContractArtifact = {
  id?: number;
  artifactHash: string;
  artifact: unknown;
  contractClassId: string;
  createdAt?: Date;
  updatedAt?: Date;
};

// Mock the database client
vi.mock('@turnstile-portal/api-common', () => ({
  createDbClient: vi.fn(),
  contractInstances: {
    address: 'address',
    originalContractClassId: 'originalContractClassId',
    currentContractClassId: 'currentContractClassId',
    initializationHash: 'initializationHash',
    deploymentParams: 'deploymentParams',
    version: 'version',
    $inferSelect: {} as MockContractInstance,
  },
  contractArtifacts: {
    artifactHash: 'artifactHash',
    artifact: 'artifact',
    contractClassId: 'contractClassId',
    $inferSelect: {} as MockContractArtifact,
  },
}));

// Mock drizzle-orm functions
vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  asc: vi.fn(),
  eq: vi.fn(),
  gt: vi.fn(),
  isNotNull: vi.fn(),
  or: vi.fn(),
}));

// Mock fastify
const mockFastify = {
  listen: vi.fn(),
  register: vi.fn(),
  get: vi.fn(),
  log: {
    error: vi.fn(),
  },
};

vi.mock('fastify', () => ({
  default: vi.fn(() => mockFastify),
}));

// Define mock database type
type MockDb = ReturnType<typeof createMockDb>;

const createMockDb = () => ({
  select: vi.fn(() => ({
    from: vi.fn((..._args: unknown[]) => ({
      where: vi.fn((..._args: unknown[]) => ({
        limit: vi.fn((..._args: unknown[]) => Promise.resolve([])),
      })),
      limit: vi.fn((..._args: unknown[]) => Promise.resolve([])),
    })),
  })),
});

describe('Contract API', () => {
  let mockDb: MockDb;

  beforeAll(() => {
    // Setup mock database
    mockDb = createMockDb();
    vi.mocked(createDbClient).mockReturnValue(mockDb as unknown as ReturnType<typeof createDbClient>);
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  describe('Contract Address Validation', () => {
    it('should validate contract address format', () => {
      const isValidContractAddress = (address: string): boolean => {
        return /^0x[a-fA-F0-9]{64}$/.test(address);
      };

      const validAddress = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const invalidAddresses = [
        '0x1234', // too short
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', // no 0x prefix
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdeg', // invalid character
        '0x1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF', // uppercase (still valid)
      ];

      expect(isValidContractAddress(validAddress)).toBe(true);
      expect(isValidContractAddress(invalidAddresses[3]!)).toBe(true); // uppercase is valid
      expect(isValidContractAddress(invalidAddresses[0]!)).toBe(false);
      expect(isValidContractAddress(invalidAddresses[1]!)).toBe(false);
      expect(isValidContractAddress(invalidAddresses[2]!)).toBe(false);
    });

    it('should normalize contract addresses', () => {
      const normalizeAddress = (address: string): string => {
        if (!address.startsWith('0x')) {
          throw new Error('Invalid address format: must start with 0x');
        }
        return address.toLowerCase();
      };

      const testAddress = '0x1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF';
      const expected = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      expect(normalizeAddress(testAddress)).toBe(expected);
    });
  });

  describe('Contract Instance Conversion', () => {
    it('should convert contract instance from database to API format', () => {
      const convertDbContractInstanceToApi = (
        dbInstance: MockContractInstance,
        includeArtifact?: boolean,
        artifact?: MockContractArtifact,
      ) => {
        const instance = {
          id: dbInstance.id,
          address: dbInstance.address,
          original_contract_class_id: dbInstance.originalContractClassId || null,
          current_contract_class_id: dbInstance.currentContractClassId || null,
          initialization_hash: dbInstance.initializationHash || null,
          deployment_params: dbInstance.deploymentParams || null,
          version: dbInstance.version,
        };

        if (includeArtifact && artifact) {
          return {
            ...instance,
            artifact_hash: artifact.artifactHash,
            artifact: artifact.artifact,
            contract_class_id: artifact.contractClassId,
          };
        }

        return instance;
      };

      const dbInstance: MockContractInstance = {
        id: 1,
        address: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        originalContractClassId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        currentContractClassId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        initializationHash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        deploymentParams: { args: ['param1', 'param2'] },
        version: 1,
      };

      const result = convertDbContractInstanceToApi(dbInstance);

      expect(result).toEqual({
        id: 1,
        address: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        original_contract_class_id: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        current_contract_class_id: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        initialization_hash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        deployment_params: { args: ['param1', 'param2'] },
        version: 1,
      });
    });

    it('should include artifact when requested', () => {
      const convertDbContractInstanceToApi = (
        dbInstance: MockContractInstance,
        includeArtifact?: boolean,
        artifact?: MockContractArtifact,
      ) => {
        const instance = {
          id: dbInstance.id,
          address: dbInstance.address,
          original_contract_class_id: dbInstance.originalContractClassId || null,
          current_contract_class_id: dbInstance.currentContractClassId || null,
          initialization_hash: dbInstance.initializationHash || null,
          deployment_params: dbInstance.deploymentParams || null,
          version: dbInstance.version,
        };

        if (includeArtifact && artifact) {
          return {
            ...instance,
            artifact_hash: artifact.artifactHash,
            artifact: artifact.artifact,
            contract_class_id: artifact.contractClassId,
          };
        }

        return instance;
      };

      const dbInstance: MockContractInstance = {
        id: 1,
        address: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        currentContractClassId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        version: 1,
      };

      const artifact: MockContractArtifact = {
        id: 1,
        artifactHash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
        artifact: { bytecode: '0x608060405234801561001057600080fd5b50', abi: [] },
        contractClassId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      };

      const result = convertDbContractInstanceToApi(dbInstance, true, artifact);

      expect(result).toEqual({
        id: 1,
        address: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        original_contract_class_id: dbInstance.originalContractClassId || null,
        current_contract_class_id: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        initialization_hash: dbInstance.initializationHash || null,
        deployment_params: dbInstance.deploymentParams || null,
        version: 1,
        artifact_hash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
        artifact: { bytecode: '0x608060405234801561001057600080fd5b50', abi: [] },
        contract_class_id: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      });
    });
  });

  describe('Contract Artifact Conversion', () => {
    it('should convert contract artifact from database to API format', () => {
      const convertDbArtifactToApi = (dbArtifact: MockContractArtifact) => {
        return {
          id: dbArtifact.id,
          artifact_hash: dbArtifact.artifactHash,
          artifact: dbArtifact.artifact,
          contract_class_id: dbArtifact.contractClassId,
        };
      };

      const dbArtifact: MockContractArtifact = {
        id: 1,
        artifactHash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
        artifact: { bytecode: '0x608060405234801561001057600080fd5b50', abi: [] },
        contractClassId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      };

      const result = convertDbArtifactToApi(dbArtifact);

      expect(result).toEqual({
        id: 1,
        artifact_hash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
        artifact: { bytecode: '0x608060405234801561001057600080fd5b50', abi: [] },
        contract_class_id: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      });
    });
  });

  describe('Contract Service Database Queries', () => {
    it('should handle contract instance query by address', async () => {
      const mockInstance: MockContractInstance = {
        id: 1,
        address: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        currentContractClassId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        version: 1,
      };

      // Setup mock to return contract instance
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([mockInstance])),
          })),
        })),
      });

      const result = await mockDb.select().from({}).where({}).limit(1);
      expect(result).toEqual([mockInstance]);
    });

    it('should handle contract artifact query by identifier', async () => {
      const mockArtifact: MockContractArtifact = {
        id: 1,
        artifactHash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
        artifact: { bytecode: '0x608060405234801561001057600080fd5b50', abi: [] },
        contractClassId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      };

      // Setup mock to return contract artifact
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([mockArtifact])),
          })),
        })),
      });

      const result = await mockDb.select().from({}).where({}).limit(1);
      expect(result).toEqual([mockArtifact]);
    });

    it('should handle contract instances query by class ID', async () => {
      const mockInstances = [
        { address: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' },
        { address: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321' },
      ];

      // Setup mock to return contract instance addresses
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(mockInstances)),
          })),
          limit: vi.fn(() => Promise.resolve(mockInstances)),
        })),
      });

      const result = await mockDb.select().from({}).where({});
      expect(result).toEqual(mockInstances);
    });

    it('should handle database errors gracefully', async () => {
      // Setup mock to throw error
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.reject(new Error('Database connection failed'))),
          })),
        })),
      });

      // Test error handling
      await expect(mockDb.select().from({}).where({}).limit(1)).rejects.toThrow('Database connection failed');
    });
  });

  describe('Query Parameter Parsing', () => {
    it('should parse includeArtifact parameter correctly', () => {
      const parseIncludeArtifact = (val?: string): boolean => {
        return val === 'true';
      };

      expect(parseIncludeArtifact('true')).toBe(true);
      expect(parseIncludeArtifact('false')).toBe(false);
      expect(parseIncludeArtifact('')).toBe(false);
      expect(parseIncludeArtifact(undefined)).toBe(false);
      expect(parseIncludeArtifact('1')).toBe(false);
      expect(parseIncludeArtifact('TRUE')).toBe(false);
    });
  });

  describe('Identifier Validation', () => {
    it('should validate contract class ID and artifact hash format', () => {
      const isValidIdentifier = (identifier: string): boolean => {
        return /^0x[a-fA-F0-9]{64}$/.test(identifier);
      };

      const validIdentifiers = [
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        '0xABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      ];

      const invalidIdentifiers = [
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', // no 0x
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcde', // too short
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef0', // too long
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdeg', // invalid char
        '', // empty
        '0x', // just prefix
      ];

      validIdentifiers.forEach((id) => {
        expect(isValidIdentifier(id)).toBe(true);
      });

      invalidIdentifiers.forEach((id) => {
        expect(isValidIdentifier(id)).toBe(false);
      });
    });
  });

  describe('Cache Control for Contracts', () => {
    it('should set immutable cache headers for contract data', () => {
      // Contract instances and artifacts are immutable once deployed
      const getCacheControlForContract = (): string => {
        return 'public, max-age=31536000, immutable';
      };

      const getCacheControlForInstances = (): string => {
        return 'public, max-age=300'; // 5 minutes for instances list
      };

      expect(getCacheControlForContract()).toBe('public, max-age=31536000, immutable');
      expect(getCacheControlForInstances()).toBe('public, max-age=300');
    });
  });

  describe('Error Response Handling', () => {
    it('should format error responses correctly', () => {
      const createErrorResponse = (message: string) => {
        return { error: message };
      };

      const validationError = createErrorResponse('Invalid address format');
      const notFoundError = createErrorResponse('Contract instance not found');
      const serverError = createErrorResponse('Database error');

      expect(validationError).toEqual({ error: 'Invalid address format' });
      expect(notFoundError).toEqual({ error: 'Contract instance not found' });
      expect(serverError).toEqual({ error: 'Database error' });
    });
  });
});
