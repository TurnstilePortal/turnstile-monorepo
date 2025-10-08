import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockLogger } from '../test/mocks/logger.js';

/**
 * Mock DB layer:
 * - getDatabase: returns a chainable mock with select/insert/update.
 * - getTokenMetadataByL1Address: retained for direct reads in collector after ensureTokenMetadata.
 */
vi.mock('../db.js', () => {
  const getTokenMetadataByL1Address = vi.fn();

  const mockDb = {
    // select chain
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),

    // insert chain
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),

    // update chain
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };

  const getDatabase = vi.fn(() => mockDb);

  return {
    getDatabase,
    getTokenMetadataByL1Address,
  };
});

/**
 * Mock MetadataService to prevent actual chain calls
 */
vi.mock('../services/metadata.js', () => {
  return {
    MetadataService: vi.fn().mockImplementation(() => ({
      ensureTokenMetadata: vi.fn().mockResolvedValue('present'),
    })),
  };
});

import { L1Collector, type L1CollectorConfig } from '../collectors/l1.js';
import { getTokenMetadataByL1Address } from '../db.js';

// Create a mock public client
const mockPublicClient = {
  getLogs: vi.fn(),
  readContract: vi.fn(),
  getBlockNumber: vi.fn(() => Promise.resolve(12345n)),
  getTransactionReceipt: vi.fn(),
};

vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: vi.fn(() => mockPublicClient),
    http: vi.fn(),
  };
});

describe('L1Collector', () => {
  let collector: L1Collector;
  let mockConfig: L1CollectorConfig;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    mockConfig = {
      rpcUrl: 'https://sepolia.infura.io/v3/test',
      portalAddress: '0x1234567890123456789012345678901234567890',
      inboxAddress: '0x0987654321098765432109876543210987654321',
      allowListAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      startBlock: 1000,
      chunkSize: 100,
      network: 'sepolia',
    };

    collector = new L1Collector(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const minimalConfig: L1CollectorConfig = {
        rpcUrl: 'https://sepolia.infura.io/v3/test',
        portalAddress: '0x1234567890123456789012345678901234567890',
        inboxAddress: '0x0987654321098765432109876543210987654321',
        allowListAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        network: 'sepolia',
      };

      const collector = new L1Collector(minimalConfig);
      expect(collector).toBeDefined();
    });

    it('should merge provided config with defaults', () => {
      expect(collector).toBeDefined();
    });
  });

  describe('getL1TokenRegistrations', () => {
    it('should scan for both portal and inbox events and return registrations', async () => {
      const mockPortalLogs = [
        {
          eventName: 'Registered',
          args: {
            token: '0x1111111111111111111111111111111111111111',
            leaf: '0xleaf',
            tokenId: 1n,
          },
          blockNumber: 1001n,
          transactionHash: '0xtx1',
        },
      ];

      const mockInboxLogs = [
        {
          eventName: 'MessageSent',
          args: {
            l2BlockNumber: 100n,
            index: 1n,
            hash: '0xhash',
            rollingHash: '0xrollinghash',
          },
          blockNumber: 1001n,
          transactionHash: '0xtx1',
          logIndex: 1,
        },
      ];

      mockPublicClient.getLogs.mockResolvedValueOnce(mockPortalLogs).mockResolvedValueOnce(mockInboxLogs);

      // Mock transaction receipt for getting submitter
      mockPublicClient.getTransactionReceipt.mockResolvedValueOnce({
        from: '0xsubmitter',
      });

      const registrations = await collector.getL1TokenRegistrations(1000, 1100);

      expect(mockPublicClient.getLogs).toHaveBeenCalledTimes(2);
      // No readContract calls because MetadataService is mocked
      expect(registrations).toHaveLength(1);
      expect(registrations[0]).toEqual({
        l1Address: '0x1111111111111111111111111111111111111111',
        l1RegistrationBlock: 1001,
        l1RegistrationTx: '0xtx1',
        l1RegistrationSubmitter: '0xsubmitter',
        l1ToL2MessageHash: '0xhash',
        l1ToL2MessageIndex: 1,
        l2RegistrationAvailableBlock: 100,
      });
    });

    it('should handle logs without correlation gracefully and return no registrations', async () => {
      const mockPortalLogs = [
        {
          eventName: 'Registered',
          args: {
            token: '0x1111111111111111111111111111111111111111',
            leaf: '0xleaf',
            tokenId: 1n,
          },
          blockNumber: 1001n,
          transactionHash: '0xtx1',
        },
      ];

      const mockInboxLogs = [
        {
          eventName: 'MessageSent',
          args: {
            l2BlockNumber: 100n,
            index: 1n,
            hash: '0xhash',
            rollingHash: '0xrollinghash',
          },
          blockNumber: 1001n,
          transactionHash: '0xtx2', // Different transaction hash
        },
      ];

      mockPublicClient.getLogs.mockResolvedValueOnce(mockPortalLogs).mockResolvedValueOnce(mockInboxLogs);

      const registrations = await collector.getL1TokenRegistrations(1000, 1100);

      expect(mockLogger.warn).toHaveBeenCalledWith('No correlated inbox log found for portal registration in tx 0xtx1');
      expect(mockPublicClient.readContract).not.toHaveBeenCalled();
      expect(registrations).toHaveLength(0);
    });

    it('should handle errors during scanning', async () => {
      mockPublicClient.getLogs.mockRejectedValueOnce(new Error('RPC Error'));

      await expect(collector.getL1TokenRegistrations(1000, 1100)).rejects.toThrow('RPC Error');
    });
  });
});

describe('getL1TokenAllowListEvents', () => {
  let collector: L1Collector;
  let mockConfig: L1CollectorConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear readContract mock specifically to ensure no cross-test pollution
    mockPublicClient.readContract.mockReset();

    mockConfig = {
      rpcUrl: 'https://sepolia.infura.io/v3/test',
      portalAddress: '0x1234567890123456789012345678901234567890',
      inboxAddress: '0x0987654321098765432109876543210987654321',
      allowListAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      startBlock: 1000,
      chunkSize: 100,
      network: 'sepolia',
    };
    collector = new L1Collector(mockConfig);
  });

  it('fetches metadata at PROPOSED when DB has none', async () => {
    // Allow-list log with PROPOSED status (1)
    const mockAllowListLogs = [
      {
        eventName: 'StatusUpdated',
        args: {
          addr: '0x1111111111111111111111111111111111111111',
          status: 1n, // PROPOSED
        },
        blockNumber: 1001n,
        transactionHash: '0xallow1',
      },
    ];
    mockPublicClient.getLogs.mockResolvedValueOnce(mockAllowListLogs);
    mockPublicClient.getTransactionReceipt.mockResolvedValue({ from: '0xproposer' });

    // DB says metadata missing
    (getTokenMetadataByL1Address as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      symbol: null,
      name: null,
      decimals: null,
    });

    // Chain metadata calls from MetadataService
    mockPublicClient.readContract
      .mockResolvedValueOnce('Test Token') // name
      .mockResolvedValueOnce('TEST') // symbol
      .mockResolvedValueOnce(18); // decimals

    const events = await collector.getL1TokenAllowListEvents(1000, 1100);

    expect(mockPublicClient.getLogs).toHaveBeenCalledTimes(1);
    // No readContract calls expected - MetadataService is mocked
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(
      expect.objectContaining({
        l1Address: '0x1111111111111111111111111111111111111111',
        l1AllowListStatus: 'PROPOSED',
        l1AllowListProposalTx: '0xallow1',
        l1AllowListProposer: '0xproposer',
      }),
    );
  });

  it('skips chain metadata fetch when DB already has metadata (ACCEPTED case)', async () => {
    const mockAllowListLogs = [
      {
        eventName: 'StatusUpdated',
        args: {
          addr: '0x2222222222222222222222222222222222222222',
          status: 2n, // ACCEPTED
        },
        blockNumber: 1002n,
        transactionHash: '0xallow2',
      },
    ];
    mockPublicClient.getLogs.mockResolvedValueOnce(mockAllowListLogs);
    mockPublicClient.getTransactionReceipt.mockResolvedValue({ from: '0xapprover' });

    // DB already has metadata
    (getTokenMetadataByL1Address as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      symbol: 'ABC',
      name: 'ABC Token',
      decimals: 18,
    });

    const events = await collector.getL1TokenAllowListEvents(1000, 1100);

    // No readContract calls expected - MetadataService is mocked
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(
      expect.objectContaining({
        l1Address: '0x2222222222222222222222222222222222222222',
        l1AllowListStatus: 'ACCEPTED',
        l1AllowListResolutionTx: '0xallow2',
        l1AllowListApprover: '0xapprover',
      }),
    );
    // Ensure we did not include metadata fields since we didn't fetch
    expect(events[0]).not.toHaveProperty('symbol');
    expect(events[0]).not.toHaveProperty('name');
    expect(events[0]).not.toHaveProperty('decimals');
  });
});
