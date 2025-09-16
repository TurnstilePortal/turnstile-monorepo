import type { NewToken } from '@turnstile-portal/api-common/schema';
import { tokens } from '@turnstile-portal/api-common/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbClient } from '../db.js';
import {
  destroyDatabase,
  getDatabase,
  getTokenMetadataByL1Address,
  setDatabase,
  storeL1TokenAllowListEvents,
  storeL1TokenRegistrations,
  storeL2TokenRegistrations,
} from '../db.js';

// Mock createDbClient module
vi.mock('@turnstile-portal/api-common', () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    $client: {},
  };
  return {
    createDbClient: vi.fn(() => mockDb),
  };
});

describe('Database Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDatabase(null);
  });

  describe('getDatabase', () => {
    it('should throw error if DATABASE_URL is not set', () => {
      const originalEnv = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;

      expect(() => getDatabase()).toThrow('DATABASE_URL environment variable is not set');

      process.env.DATABASE_URL = originalEnv;
    });

    it('should create database instance if not exists', () => {
      const originalEnv = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgres://localhost:5432/test';

      // Since we already have a global mock, just verify the behavior
      const db = getDatabase();
      expect(db).toBeDefined();

      // Should return same instance on subsequent calls
      const db2 = getDatabase();
      expect(db2).toBe(db);

      process.env.DATABASE_URL = originalEnv;
    });
  });

  describe('destroyDatabase', () => {
    it('should close database connection if exists', async () => {
      const mockEnd = vi.fn();
      const mockDb = {
        $client: {
          end: mockEnd,
          ended: false,
        },
      };
      setDatabase(mockDb as unknown as DbClient);

      await destroyDatabase();

      expect(mockEnd).toHaveBeenCalled();
    });

    it('should not throw if database is null', async () => {
      setDatabase(null);
      await expect(destroyDatabase()).resolves.not.toThrow();
    });
  });

  describe('getTokenMetadataByL1Address', () => {
    it('should return token metadata if exists', async () => {
      const mockResult = [{ symbol: 'TKN', name: 'Token', decimals: 18 }];
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(mockResult),
      };
      setDatabase(mockDb as unknown as DbClient);

      const result = await getTokenMetadataByL1Address('0x123');

      expect(result).toEqual(mockResult[0]);
      expect(mockDb.select).toHaveBeenCalledWith({
        symbol: tokens.symbol,
        name: tokens.name,
        decimals: tokens.decimals,
      });
    });
  });

  describe('storeL1TokenRegistrations', () => {
    it('should update existing tokens with L1 registration data', async () => {
      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };
      setDatabase(mockDb as unknown as DbClient);

      const registrations: NewToken[] = [
        {
          symbol: 'TKN1',
          name: 'Token 1',
          decimals: 18,
          l1Address: '0x123',
          l1RegistrationBlock: 1,
          l1RegistrationTx: '0xabc',
          l1RegistrationSubmitter: '0xsubmitter',
          l2RegistrationAvailableBlock: 100,
        },
      ];

      await storeL1TokenRegistrations(registrations);

      expect(mockDb.update).toHaveBeenCalledWith(tokens);
      expect(mockDb.set).toHaveBeenCalledWith({
        l1RegistrationBlock: 1,
        l1RegistrationTx: '0xabc',
        l1RegistrationSubmitter: '0xsubmitter',
        l2RegistrationAvailableBlock: 100,
        updatedAt: expect.any(Date),
      });
      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('storeL2TokenRegistrations', () => {
    it('should update existing tokens with L2 data', async () => {
      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };
      setDatabase(mockDb as unknown as DbClient);

      const registrations: Partial<NewToken>[] = [
        {
          l1Address: '0x123',
          l2Address: '0x456',
          l2RegistrationBlock: 200,
          l2RegistrationTxIndex: 1,
          l2RegistrationLogIndex: 2,
          l2RegistrationTx: '0xtx',
          l2RegistrationFeePayer: '0xfeepayer',
          l2RegistrationSubmitter: '0xsubmitter',
        },
      ];

      await storeL2TokenRegistrations(registrations);

      expect(mockDb.update).toHaveBeenCalledWith(tokens);
      expect(mockDb.set).toHaveBeenCalledWith({
        l2Address: '0x456',
        l2RegistrationBlock: 200,
        l2RegistrationTxIndex: 1,
        l2RegistrationLogIndex: 2,
        l2RegistrationTx: '0xtx',
        l2RegistrationFeePayer: '0xfeepayer',
        l2RegistrationSubmitter: '0xsubmitter',
        updatedAt: expect.any(Date),
      });
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should skip tokens without L1 address', async () => {
      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };
      setDatabase(mockDb as unknown as DbClient);

      const registrations: Partial<NewToken>[] = [{ l2Address: '0x456' }];

      await storeL2TokenRegistrations(registrations);

      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('storeL1TokenAllowListEvents', () => {
    it('should update existing tokens with allowlist data', async () => {
      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };
      setDatabase(mockDb as unknown as DbClient);

      const events: NewToken[] = [
        {
          l1Address: '0x123',
          l1AllowListStatus: 'PROPOSED',
          l1AllowListProposalTx: '0xabc',
          l1AllowListProposer: '0xproposer',
        },
      ];

      await storeL1TokenAllowListEvents(events);

      expect(mockDb.update).toHaveBeenCalledWith(tokens);
      expect(mockDb.set).toHaveBeenCalledWith({
        l1AllowListStatus: 'PROPOSED',
        l1AllowListProposalTx: '0xabc',
        l1AllowListProposer: '0xproposer',
        l1AllowListResolutionTx: undefined,
        l1AllowListApprover: undefined,
        updatedAt: expect.any(Date),
      });
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should update existing tokens with allowlist data without overwriting registration data', async () => {
      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };
      setDatabase(mockDb as unknown as DbClient);

      const events: NewToken[] = [
        {
          l1Address: '0x123',
          l1AllowListStatus: 'ACCEPTED',
          l1AllowListResolutionTx: '0xdef',
          l1AllowListApprover: '0xapprover',
        },
      ];

      await storeL1TokenAllowListEvents(events);

      expect(mockDb.update).toHaveBeenCalledWith(tokens);
      expect(mockDb.set).toHaveBeenCalledWith({
        l1AllowListStatus: 'ACCEPTED',
        l1AllowListProposalTx: undefined,
        l1AllowListProposer: undefined,
        l1AllowListResolutionTx: '0xdef',
        l1AllowListApprover: '0xapprover',
        updatedAt: expect.any(Date),
      });
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should skip events without L1 address', async () => {
      const mockDb = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };
      setDatabase(mockDb as unknown as DbClient);

      const events: NewToken[] = [{ l1AllowListStatus: 'PROPOSED' }];

      await storeL1TokenAllowListEvents(events);

      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });
});
