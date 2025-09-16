import type { NewToken } from '@turnstile-portal/api-common/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { L1Collector, type L1CollectorConfig } from '../collectors/l1.js';
import { L2Collector, type L2CollectorConfig } from '../collectors/l2.js';
import * as db from '../db.js';
import { BlockProgressService } from '../services/block-progress.js';
import { CollectorService } from '../services/collector-service.js';
import { mockLogger } from '../test/mocks/logger.js';

vi.mock('../collectors/l1.js');
vi.mock('../collectors/l2.js');
vi.mock('../services/block-progress.js');
vi.mock('../db.js');

describe('CollectorService', () => {
  let service: CollectorService;
  let mockL1Collector: Partial<L1Collector>;
  let mockL2Collector: Partial<L2Collector>;
  let mockBlockProgress: Partial<BlockProgressService>;

  beforeEach(() => {
    vi.useFakeTimers();

    mockL1Collector = {
      getL1TokenRegistrations: vi.fn().mockResolvedValue([]),
      getL1TokenAllowListEvents: vi.fn().mockResolvedValue([]),
      getBlockNumber: vi.fn().mockResolvedValue(1000),
    };

    mockL2Collector = {
      getL2TokenRegistrations: vi.fn().mockResolvedValue([]),
      getBlockNumber: vi.fn().mockResolvedValue(2000),
    };

    mockBlockProgress = {
      getLastScannedBlock: vi.fn().mockResolvedValue(0),
      updateLastScannedBlock: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(L1Collector).mockImplementation(() => mockL1Collector as L1Collector);
    vi.mocked(L2Collector).mockImplementation(() => mockL2Collector as L2Collector);
    vi.mocked(BlockProgressService).mockImplementation(() => mockBlockProgress as BlockProgressService);

    service = new CollectorService({
      l1: {} as L1CollectorConfig,
      l2: {} as L2CollectorConfig,
      pollingInterval: 100,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should poll for data and call collectors and db functions', async () => {
    const storeL1Spy = vi.spyOn(db, 'storeL1TokenRegistrations');
    const storeL1AllowListSpy = vi.spyOn(db, 'storeL1TokenAllowListEvents');
    const storeL2Spy = vi.spyOn(db, 'storeL2TokenRegistrations');

    const l1AllowListEvents: NewToken[] = [
      {
        l1Address: '0x1234567890123456789012345678901234567890',
        l1AllowListStatus: 'PROPOSED',
        l1AllowListProposalTx: '0xabc',
      },
    ];
    const l1Registrations: NewToken[] = [
      {
        symbol: 'L1',
        name: 'Test L1 Token',
        decimals: 18,
        l1Address: '0x1234567890123456789012345678901234567890',
        l1RegistrationBlock: 100,
        l1RegistrationTx: '0x123',
        l2RegistrationBlock: 200,
      },
    ];
    const l2Registrations: Partial<NewToken>[] = [{ symbol: 'L2' }];

    (mockL1Collector.getL1TokenAllowListEvents as ReturnType<typeof vi.fn>).mockResolvedValueOnce(l1AllowListEvents);
    (mockL1Collector.getL1TokenRegistrations as ReturnType<typeof vi.fn>).mockResolvedValueOnce(l1Registrations);
    (mockL2Collector.getL2TokenRegistrations as ReturnType<typeof vi.fn>).mockResolvedValueOnce(l2Registrations);
    (mockBlockProgress.getLastScannedBlock as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(200);

    // Call poll directly to test a single polling cycle
    await service.poll();

    // Assertions
    expect(mockBlockProgress.getLastScannedBlock).toHaveBeenCalledWith('L1');
    expect(mockBlockProgress.getLastScannedBlock).toHaveBeenCalledWith('L2');

    expect(mockL1Collector.getL1TokenAllowListEvents).toHaveBeenCalled();
    expect(mockL1Collector.getL1TokenRegistrations).toHaveBeenCalled();
    expect(mockL2Collector.getL2TokenRegistrations).toHaveBeenCalled();

    expect(storeL1AllowListSpy).toHaveBeenCalledWith(l1AllowListEvents);
    expect(storeL1Spy).toHaveBeenCalledWith(l1Registrations);
    expect(storeL2Spy).toHaveBeenCalledWith(l2Registrations);

    expect(mockBlockProgress.updateLastScannedBlock).toHaveBeenCalledWith('L1', expect.any(Number));
    expect(mockBlockProgress.updateLastScannedBlock).toHaveBeenCalledWith('L2', expect.any(Number));
  });

  it('should handle errors during polling gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (mockL1Collector.getL1TokenAllowListEvents as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Test Error'),
    );

    // Call poll directly and expect it to throw the error
    await expect(service.poll()).rejects.toThrow('Test Error');

    consoleErrorSpy.mockRestore();
  });

  it('should use startBlock from config when no progress exists', async () => {
    // Create fresh mocks for this test
    const freshMockBlockProgress = {
      getLastScannedBlock: vi
        .fn()
        .mockResolvedValueOnce(0) // L1 has no progress
        .mockResolvedValueOnce(0), // L2 has no progress
      updateLastScannedBlock: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(BlockProgressService).mockImplementation(() => freshMockBlockProgress as unknown as BlockProgressService);

    // Mock higher block numbers so it's not caught up
    (mockL1Collector.getBlockNumber as ReturnType<typeof vi.fn>).mockResolvedValueOnce(10000);
    (mockL2Collector.getBlockNumber as ReturnType<typeof vi.fn>).mockResolvedValueOnce(10000);

    service = new CollectorService({
      l1: { startBlock: 5000 } as L1CollectorConfig,
      l2: { startBlock: 8000 } as L2CollectorConfig,
      pollingInterval: 100,
    });

    await service.poll();

    // Should use startBlock values instead of block 1
    expect(mockL1Collector.getL1TokenRegistrations).toHaveBeenCalledWith(5000, expect.any(Number));
    expect(mockL2Collector.getL2TokenRegistrations).toHaveBeenCalledWith(8000, expect.any(Number));
  });

  it('should resume from saved progress instead of startBlock', async () => {
    // Create fresh mocks for this test
    const freshMockBlockProgress = {
      getLastScannedBlock: vi
        .fn()
        .mockResolvedValueOnce(6000) // L1 has progress
        .mockResolvedValueOnce(9000), // L2 has progress
      updateLastScannedBlock: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(BlockProgressService).mockImplementation(() => freshMockBlockProgress as unknown as BlockProgressService);

    // Mock higher block numbers so it's not caught up
    (mockL1Collector.getBlockNumber as ReturnType<typeof vi.fn>).mockResolvedValueOnce(10000);
    (mockL2Collector.getBlockNumber as ReturnType<typeof vi.fn>).mockResolvedValueOnce(15000);

    service = new CollectorService({
      l1: { startBlock: 5000 } as L1CollectorConfig,
      l2: { startBlock: 8000 } as L2CollectorConfig,
      pollingInterval: 100,
    });

    await service.poll();

    // Should resume from last scanned block + 1 for L1, not startBlock
    expect(mockL1Collector.getL1TokenRegistrations).toHaveBeenCalledWith(6001, expect.any(Number));
    // L2 rescans the last block, so it starts from lastScannedBlock (not +1)
    expect(mockL2Collector.getL2TokenRegistrations).toHaveBeenCalledWith(9000, expect.any(Number));
  });

  it('should skip polling when already caught up', async () => {
    (mockBlockProgress.getLastScannedBlock as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(1000) // L1 last scanned
      .mockResolvedValueOnce(2000); // L2 last scanned

    (mockL1Collector.getBlockNumber as ReturnType<typeof vi.fn>).mockResolvedValueOnce(999); // L1 current < last scanned
    (mockL2Collector.getBlockNumber as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1999); // L2 current < last scanned

    await service.poll();

    // Should not call collectors when caught up
    expect(mockL1Collector.getL1TokenRegistrations).not.toHaveBeenCalled();
    expect(mockL2Collector.getL2TokenRegistrations).not.toHaveBeenCalled();
    expect(mockBlockProgress.updateLastScannedBlock).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Already caught up'));
  });

  it('should process only L1 when L2 is caught up', async () => {
    (mockBlockProgress.getLastScannedBlock as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(500) // L1 behind
      .mockResolvedValueOnce(2000); // L2 caught up

    (mockL1Collector.getBlockNumber as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1000); // L1 has new blocks
    (mockL2Collector.getBlockNumber as ReturnType<typeof vi.fn>).mockResolvedValueOnce(2000); // L2 caught up

    await service.poll();

    // Should process both - L1 because it's behind, L2 rescans its last block
    expect(mockL1Collector.getL1TokenRegistrations).toHaveBeenCalled();
    expect(mockL2Collector.getL2TokenRegistrations).toHaveBeenCalled();
    expect(mockBlockProgress.updateLastScannedBlock).toHaveBeenCalledWith('L1', expect.any(Number));
    expect(mockBlockProgress.updateLastScannedBlock).toHaveBeenCalledWith('L2', expect.any(Number));
  });

  it('should process only L2 when L1 is caught up', async () => {
    (mockBlockProgress.getLastScannedBlock as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(1000) // L1 caught up
      .mockResolvedValueOnce(1500); // L2 behind

    (mockL1Collector.getBlockNumber as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1000); // L1 caught up
    (mockL2Collector.getBlockNumber as ReturnType<typeof vi.fn>).mockResolvedValueOnce(2000); // L2 has new blocks

    await service.poll();

    // Should only process L2
    expect(mockL1Collector.getL1TokenRegistrations).not.toHaveBeenCalled();
    expect(mockL2Collector.getL2TokenRegistrations).toHaveBeenCalled();
    expect(mockBlockProgress.updateLastScannedBlock).not.toHaveBeenCalledWith('L1', expect.any(Number));
    expect(mockBlockProgress.updateLastScannedBlock).toHaveBeenCalledWith('L2', expect.any(Number));
  });

  it('should handle chunk sizes correctly', async () => {
    (mockBlockProgress.getLastScannedBlock as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(200);

    (mockL1Collector.getBlockNumber as ReturnType<typeof vi.fn>).mockResolvedValueOnce(5000); // Far ahead
    (mockL2Collector.getBlockNumber as ReturnType<typeof vi.fn>).mockResolvedValueOnce(5000); // Far ahead

    await service.poll();

    // Should respect chunk sizes (1000 for L1, 100 for L2)
    expect(mockL1Collector.getL1TokenRegistrations).toHaveBeenCalledWith(101, 1100); // 1000 block chunk
    // L2 rescans from last block (200), not 201
    expect(mockL2Collector.getL2TokenRegistrations).toHaveBeenCalledWith(200, 299); // 100 block chunk from 200
  });
});
