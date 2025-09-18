/** biome-ignore-all lint/suspicious/noExplicitAny: test */
import { inspect } from 'node:util';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { L2Collector, type L2CollectorConfig } from '../collectors/l2.js';
import type { DbClient } from '../db.js';
import { setDatabase } from '../db.js';
import { scanForRegisterEvents } from '../utils/portal-events.js';

// Mock viem
vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({ mockClient: true })),
  http: vi.fn(() => ({ mockTransport: true })),
  anvil: { id: 31337, name: 'Anvil' },
  mainnet: { id: 1, name: 'Mainnet' },
  sepolia: { id: 11155111, name: 'Sepolia' },
}));

// Mock Aztec node client
const mockAztecNodeClient = {
  getBlockNumber: vi.fn(),
  getBlock: vi.fn(),
};

vi.mock('@aztec/aztec.js', () => ({
  createAztecNodeClient: vi.fn(() => mockAztecNodeClient),
  AztecAddress: {
    fromString: vi.fn((addr: string) => ({
      toString: () => addr,
      equals: vi.fn(),
      toBuffer: vi.fn(),
      isEmpty: vi.fn(() => false),
      isZero: vi.fn(() => false),
      toBigInt: vi.fn(),
      toField: vi.fn(),
      toNoirStruct: vi.fn(),
    })),
  },
  EthAddress: {
    fromString: vi.fn((addr: string) => ({
      toString: () => addr,
      buffer: Buffer.from(`0x${addr.slice(2)}`, 'hex'),
      isZero: vi.fn(() => false),
      equals: vi.fn(),
      toChecksumString: vi.fn(() => addr),
      toBuffer: vi.fn(),
      toBigInt: vi.fn(),
      toField: vi.fn(),
      toNoirStruct: vi.fn(),
      toShortString: vi.fn(() => `${addr.slice(0, 8)}...`),
    })),
  },
}));

vi.mock('../db.js', async () => {
  const actual = await vi.importActual('../db.js');
  return {
    ...actual,
    getDatabase: vi.fn(),
  };
});

// Mock MetadataService
const mockMetadataService = {
  ensureTokenMetadata: vi.fn(),
  getTokenMetadata: vi.fn(),
};

vi.mock('../services/metadata.js', () => ({
  MetadataService: vi.fn(() => mockMetadataService),
}));

// Mock ContractRegistryService
const mockContractRegistryService = {
  storeTokenInstance: vi.fn(),
};

vi.mock('../services/contract-registry.js', () => ({
  ContractRegistryService: vi.fn(() => mockContractRegistryService),
}));

vi.mock('../utils/portal-events.js', () => ({
  scanForRegisterEvents: vi.fn(),
}));

// Mock address normalization
vi.mock('../utils/address.js', () => ({
  normalizeL1Address: vi.fn((addr: string) => addr.toLowerCase()),
  normalizeL2Address: vi.fn((addr: string) => addr.toLowerCase()),
}));

describe('L2Collector', () => {
  let collector: L2Collector;
  let config: L2CollectorConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      nodeUrl: 'http://localhost:8080',
      portalAddress: '0x1234567890123456789012345678901234567890',
      startBlock: 1,
      chunkSize: 100,
      l1RpcUrl: 'http://localhost:8545',
      network: 'sandbox',
    };

    setDatabase({} as DbClient);

    collector = new L2Collector(config);
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const minimalConfig = {
        nodeUrl: 'http://localhost:8080',
        portalAddress: '0x1234567890123456789012345678901234567890',
        l1RpcUrl: 'http://localhost:8545',
        network: 'sandbox',
      };

      const minimalCollector = new L2Collector(minimalConfig);
      expect(minimalCollector).toBeDefined();
    });

    it('should handle unknown network gracefully', () => {
      const unknownNetworkConfig = {
        ...config,
        network: 'unknown-network',
      };

      expect(() => new L2Collector(unknownNetworkConfig)).not.toThrow();
    });
  });

  describe('getBlockNumber', () => {
    it('should return block number from aztec node', async () => {
      mockAztecNodeClient.getBlockNumber.mockResolvedValue(100);

      const blockNumber = await collector.getBlockNumber();

      expect(blockNumber).toBe(100);
      expect(mockAztecNodeClient.getBlockNumber).toHaveBeenCalled();
    });
  });

  describe('getL2TokenRegistrations', () => {
    const mockBlock = {
      body: {
        txEffects: [
          {
            txHash: { toString: () => '0xtxhash123' },
          },
        ],
      },
    };

    const mockEvent = {
      blockNumber: 10,
      txIndex: 0,
      logId: {
        blockNumber: 10,
        txIndex: 0,
        logIndex: 1,
        toBuffer: vi.fn(),
        toHumanReadable: vi.fn(() => 'log-10-0-1'),
      },
      logIndex: 1,
      ethToken: {
        toString: () => '0xETHTokenAddress',
        isZero: vi.fn(() => false),
        equals: vi.fn(),
        toChecksumString: vi.fn(() => '0xETHTokenAddress'),
        toBuffer: vi.fn(),
        toBigInt: vi.fn(),
        toField: vi.fn(),
        toNoirStruct: vi.fn(),
        toShortString: vi.fn(() => '0xETHTok...'),
        toBuffer32: vi.fn(),
        toJSON: vi.fn(),
        [inspect.custom]: vi.fn(() => '0xETHTokenAddress'),
      },
      aztecToken: {
        toString: () => '0xAztecTokenAddress',
        equals: vi.fn(),
        toBuffer: vi.fn(),
        isEmpty: vi.fn(() => false),
        isZero: vi.fn(() => false),
        toBigInt: vi.fn(),
        toField: vi.fn(),
        toNoirStruct: vi.fn(),
      },
    };

    beforeEach(() => {
      mockAztecNodeClient.getBlock.mockResolvedValue(mockBlock);
      mockMetadataService.ensureTokenMetadata.mockResolvedValue('fetched');
    });

    it('should process L2 token registrations without metadata', async () => {
      vi.mocked(scanForRegisterEvents).mockResolvedValue([mockEvent as any]);
      mockMetadataService.getTokenMetadata.mockResolvedValue(null);

      const registrations = await collector.getL2TokenRegistrations(1, 10);

      expect(registrations).toHaveLength(1);
      expect(registrations[0]).toEqual({
        l1Address: '0xethtokenaddress',
        l2Address: '0xaztectokenaddress',
        l2RegistrationBlock: 10,
        l2RegistrationTxIndex: 0,
        l2RegistrationLogIndex: 1,
        l2RegistrationTx: '0xtxhash123',
      });

      expect(mockMetadataService.ensureTokenMetadata).toHaveBeenCalledWith('0xethtokenaddress');
      expect(mockContractRegistryService.storeTokenInstance).not.toHaveBeenCalled();
    });

    it('should process L2 token registrations and store contract instances', async () => {
      const mockMetadata = {
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 18,
      };

      vi.mocked(scanForRegisterEvents).mockResolvedValue([mockEvent as any]);
      mockMetadataService.getTokenMetadata.mockResolvedValue(mockMetadata);

      const registrations = await collector.getL2TokenRegistrations(1, 10);

      expect(registrations).toHaveLength(1);
      expect(registrations[0]).toEqual({
        l1Address: '0xethtokenaddress',
        l2Address: '0xaztectokenaddress',
        l2RegistrationBlock: 10,
        l2RegistrationTxIndex: 0,
        l2RegistrationLogIndex: 1,
        l2RegistrationTx: '0xtxhash123',
      });

      expect(mockMetadataService.ensureTokenMetadata).toHaveBeenCalledWith('0xethtokenaddress');
      expect(mockMetadataService.getTokenMetadata).toHaveBeenCalledWith('0xethtokenaddress');
      expect(mockContractRegistryService.storeTokenInstance).toHaveBeenCalledWith(
        expect.objectContaining({ toString: expect.any(Function) }), // AztecAddress for l2Address
        expect.objectContaining({ toString: expect.any(Function) }), // AztecAddress for portalAddress
        mockMetadata,
      );
    });

    it('should handle contract registry errors gracefully', async () => {
      const mockMetadata = {
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 18,
      };

      vi.mocked(scanForRegisterEvents).mockResolvedValue([mockEvent as any]);
      mockMetadataService.getTokenMetadata.mockResolvedValue(mockMetadata);
      mockContractRegistryService.storeTokenInstance.mockRejectedValue(new Error('Contract registry error'));

      const registrations = await collector.getL2TokenRegistrations(1, 10);

      // Should still return the registration even if contract instance storage fails
      expect(registrations).toHaveLength(1);
      expect(registrations[0]).toEqual({
        l1Address: '0xethtokenaddress',
        l2Address: '0xaztectokenaddress',
        l2RegistrationBlock: 10,
        l2RegistrationTxIndex: 0,
        l2RegistrationLogIndex: 1,
        l2RegistrationTx: '0xtxhash123',
      });
    });

    it('should return empty array when no events found', async () => {
      vi.mocked(scanForRegisterEvents).mockResolvedValue([]);

      const registrations = await collector.getL2TokenRegistrations(1, 10);

      expect(registrations).toHaveLength(0);
      expect(mockMetadataService.ensureTokenMetadata).not.toHaveBeenCalled();
    });

    it('should handle multiple events', async () => {
      const mockEvent2 = {
        blockNumber: 11,
        txIndex: 0,
        logId: {
          blockNumber: 11,
          txIndex: 0,
          logIndex: 0,
          toBuffer: vi.fn(),
          toHumanReadable: vi.fn(() => 'log-11-0-0'),
        },
        logIndex: 0,
        ethToken: {
          toString: () => '0xETHToken2Address',
          isZero: vi.fn(() => false),
          equals: vi.fn(),
          toChecksumString: vi.fn(() => '0xETHToken2Address'),
          toBuffer: vi.fn(),
          toBigInt: vi.fn(),
          toField: vi.fn(),
          toNoirStruct: vi.fn(),
          toShortString: vi.fn(() => '0xETHTok...'),
          toBuffer32: vi.fn(),
          toJSON: vi.fn(),
          [inspect.custom]: vi.fn(() => '0xETHToken2Address'),
        },
        aztecToken: {
          toString: () => '0xAztecToken2Address',
          equals: vi.fn(),
          toBuffer: vi.fn(),
          isEmpty: vi.fn(() => false),
          isZero: vi.fn(() => false),
          toBigInt: vi.fn(),
          toField: vi.fn(),
          toNoirStruct: vi.fn(),
        },
      };

      const mockBlock2 = {
        body: {
          txEffects: [
            {
              txHash: { toString: () => '0xtxhash456' },
            },
          ],
        },
      };

      vi.mocked(scanForRegisterEvents).mockResolvedValue([mockEvent as any, mockEvent2 as any]);
      mockAztecNodeClient.getBlock.mockImplementation((blockNum: number) => {
        if (blockNum === 10) return Promise.resolve(mockBlock);
        if (blockNum === 11) return Promise.resolve(mockBlock2);
        return Promise.resolve(null);
      });

      const mockMetadata = {
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 18,
      };
      mockMetadataService.getTokenMetadata.mockResolvedValue(mockMetadata);

      const registrations = await collector.getL2TokenRegistrations(1, 11);

      expect(registrations).toHaveLength(2);
      expect(mockMetadataService.ensureTokenMetadata).toHaveBeenCalledTimes(2);
      expect(mockContractRegistryService.storeTokenInstance).toHaveBeenCalledTimes(2);
    });

    it('should throw error if block not found', async () => {
      vi.mocked(scanForRegisterEvents).mockResolvedValue([mockEvent as any]);
      mockAztecNodeClient.getBlock.mockResolvedValue(null);

      await expect(collector.getL2TokenRegistrations(1, 10)).rejects.toThrow('L2 Block 10 not found');
    });

    it('should throw error if tx effect not found', async () => {
      vi.mocked(scanForRegisterEvents).mockResolvedValue([mockEvent as any]);
      mockAztecNodeClient.getBlock.mockResolvedValue({
        body: { txEffects: [] },
      });

      await expect(collector.getL2TokenRegistrations(1, 10)).rejects.toThrow('L2 Tx index 0 not found in block 10');
    });
  });

  describe('integration with services', () => {
    it('should pass portal address to contract registry service', async () => {
      const mockEvent = {
        blockNumber: 10,
        txIndex: 0,
        logId: {
          blockNumber: 10,
          txIndex: 0,
          logIndex: 1,
          toBuffer: vi.fn(),
          toHumanReadable: vi.fn(() => 'log-10-0-1'),
        },
        logIndex: 1,
        ethToken: {
          toString: () => '0xETHTokenAddress',
          isZero: vi.fn(() => false),
          equals: vi.fn(),
          toChecksumString: vi.fn(() => '0xETHTokenAddress'),
          toBuffer: vi.fn(),
          toBigInt: vi.fn(),
          toField: vi.fn(),
          toNoirStruct: vi.fn(),
          toShortString: vi.fn(() => '0xETHTok...'),
          toBuffer32: vi.fn(),
          toJSON: vi.fn(),
          [inspect.custom]: vi.fn(() => '0xETHTokenAddress'),
        },
        aztecToken: {
          toString: () => '0xAztecTokenAddress',
          equals: vi.fn(),
          toBuffer: vi.fn(),
          isEmpty: vi.fn(() => false),
          isZero: vi.fn(() => false),
          toBigInt: vi.fn(),
          toField: vi.fn(),
          toNoirStruct: vi.fn(),
        },
      };

      const mockBlock = {
        body: {
          txEffects: [
            {
              txHash: { toString: () => '0xtxhash123' },
            },
          ],
        },
      };

      const mockMetadata = {
        name: 'Test Token',
        symbol: 'TEST',
        decimals: 18,
      };

      vi.mocked(scanForRegisterEvents).mockResolvedValue([mockEvent as any]);
      mockAztecNodeClient.getBlock.mockResolvedValue(mockBlock);
      mockMetadataService.getTokenMetadata.mockResolvedValue(mockMetadata);

      await collector.getL2TokenRegistrations(1, 10);

      expect(mockContractRegistryService.storeTokenInstance).toHaveBeenCalledWith(
        expect.objectContaining({ toString: expect.any(Function) }), // L2 token address
        expect.objectContaining({ toString: expect.any(Function) }), // Portal address
        mockMetadata,
      );
    });
  });
});
