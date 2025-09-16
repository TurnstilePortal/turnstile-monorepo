import { blockProgress } from '@turnstile-portal/api-common/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbClient } from '../db.js';
import * as db from '../db.js';
import { BlockProgressService } from '../services/block-progress.js';
import { mockLogger } from '../test/mocks/logger.js';

vi.mock('../db.js');

describe('BlockProgressService', () => {
  let service: BlockProgressService;
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(db.getDatabase).mockReturnValue(mockDb as unknown as DbClient);

    service = new BlockProgressService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getLastScannedBlock', () => {
    it('should return 0 and initialize record when no progress exists', async () => {
      mockDb.limit.mockResolvedValueOnce([]);
      const insertSpy = vi.spyOn(mockDb, 'values');

      const result = await service.getLastScannedBlock('L1');

      expect(result).toBe(0);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(insertSpy).toHaveBeenCalledWith({
        chain: 'L1',
        lastScannedBlock: 0,
        lastScanTimestamp: expect.any(Date),
      });
    });

    it('should return existing block number when progress exists', async () => {
      mockDb.limit.mockResolvedValueOnce([{ lastScannedBlock: 12345 }]);

      const result = await service.getLastScannedBlock('L2');

      expect(result).toBe(12345);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should handle L1 and L2 chains separately', async () => {
      mockDb.limit
        .mockResolvedValueOnce([{ lastScannedBlock: 1000 }])
        .mockResolvedValueOnce([{ lastScannedBlock: 2000 }]);

      const l1Result = await service.getLastScannedBlock('L1');
      const l2Result = await service.getLastScannedBlock('L2');

      expect(l1Result).toBe(1000);
      expect(l2Result).toBe(2000);
    });
  });

  describe('updateLastScannedBlock', () => {
    it('should update existing record', async () => {
      // Mock the select check for existing record
      mockDb.limit.mockResolvedValueOnce([{ id: 1 }]);

      await service.updateLastScannedBlock('L1', 5000);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalledWith(blockProgress);
      expect(mockDb.set).toHaveBeenCalledWith({
        lastScannedBlock: 5000,
        lastScanTimestamp: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should insert new record when no existing record', async () => {
      // Mock the select check for existing record - returns empty
      mockDb.limit.mockResolvedValueOnce([]);
      const insertSpy = vi.spyOn(mockDb, 'values');

      await service.updateLastScannedBlock('L2', 3000);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(insertSpy).toHaveBeenCalledWith({
        chain: 'L2',
        lastScannedBlock: 3000,
        lastScanTimestamp: expect.any(Date),
      });
    });

    it('should log the update', async () => {
      // Mock the select check for existing record
      mockDb.limit.mockResolvedValueOnce([{ id: 1 }]);

      await service.updateLastScannedBlock('L1', 7500);

      expect(mockLogger.debug).toHaveBeenCalledWith('Updated L1 last scanned block to 7500');
    });
  });

  describe('getProgress', () => {
    it('should return full progress record when exists', async () => {
      const mockProgress = {
        id: 1,
        chain: 'L1',
        lastScannedBlock: 9999,
        lastScanTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDb.limit.mockResolvedValueOnce([mockProgress]);

      const result = await service.getProgress('L1');

      expect(result).toEqual(mockProgress);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(blockProgress);
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should return null when no progress exists', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await service.getProgress('L2');

      expect(result).toBeNull();
    });
  });
});
