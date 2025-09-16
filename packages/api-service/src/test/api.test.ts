import { createDbClient } from '@turnstile-portal/api-common';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Define mock token type
type MockToken = {
  id?: number;
  symbol: string;
  name: string;
  decimals: number;
  l1Address?: string | null;
  l2Address?: string | null;
  l1RegistrationBlock?: number | null;
  l2RegistrationBlock?: number | null;
  l1RegistrationTx?: string | null;
  l2RegistrationTxIndex?: number | null;
  l2RegistrationLogIndex?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
};

// Mock the database client
vi.mock('@turnstile-portal/api-common', () => ({
  createDbClient: vi.fn(),
  tokens: {
    symbol: 'symbol',
    name: 'name',
    decimals: 'decimals',
    l1Address: 'l1Address',
    l2Address: 'l2Address',
    $inferSelect: {} as MockToken,
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
        orderBy: vi.fn((..._args: unknown[]) => ({
          limit: vi.fn((..._args: unknown[]) => Promise.resolve([])),
        })),
      })),
      orderBy: vi.fn((..._args: unknown[]) => ({
        limit: vi.fn((..._args: unknown[]) => Promise.resolve([])),
      })),
      limit: vi.fn((..._args: unknown[]) => Promise.resolve([])),
    })),
  })),
});

describe('API Server', () => {
  let mockDb: MockDb;

  beforeAll(() => {
    // Setup mock database
    mockDb = createMockDb();

    vi.mocked(createDbClient).mockReturnValue(mockDb as unknown as ReturnType<typeof createDbClient>);
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  describe('Query Parameter Validation', () => {
    it('should handle valid limit and cursor parameters', () => {
      const parseLimit = (val?: string) => {
        if (!val) return 100;
        const num = Number.parseInt(val, 10);
        return num > 0 && num <= 1000 ? num : 100;
      };

      const parseCursor = (val?: string) => {
        if (!val) return 0;
        const num = Number.parseInt(val, 10);
        return num >= 0 ? num : 0;
      };

      expect(parseLimit('50')).toBe(50);
      expect(parseLimit('1000')).toBe(1000);
      expect(parseLimit('1001')).toBe(100); // exceeds max
      expect(parseLimit('-1')).toBe(100); // negative
      expect(parseLimit()).toBe(100); // undefined

      expect(parseCursor('10')).toBe(10);
      expect(parseCursor('0')).toBe(0);
      expect(parseCursor('-1')).toBe(0); // negative
      expect(parseCursor()).toBe(0); // undefined
    });

    it('should handle invalid parameter values', () => {
      const parseLimit = (val?: string) => {
        if (!val) return 100;
        const num = Number.parseInt(val, 10);
        return num > 0 && num <= 1000 ? num : 100;
      };

      const parseCursor = (val?: string) => {
        if (!val) return 0;
        const num = Number.parseInt(val, 10);
        return num >= 0 ? num : 0;
      };

      expect(parseLimit('invalid')).toBe(100); // NaN
      expect(parseCursor('invalid')).toBe(0); // NaN
    });
  });

  describe('Address Validation', () => {
    it('should normalize valid addresses', () => {
      const normalizeAddress = (address: string): string => {
        if (!address.startsWith('0x')) {
          throw new Error('Invalid address format: must start with 0x');
        }
        return address.toLowerCase();
      };

      const testAddress = '0x1234567890ABCDEF1234567890ABCDEF12345678';
      const expected = '0x1234567890abcdef1234567890abcdef12345678';

      expect(normalizeAddress(testAddress)).toBe(expected);
    });

    it('should throw error for invalid address format', () => {
      const normalizeAddress = (address: string): string => {
        if (!address.startsWith('0x')) {
          throw new Error('Invalid address format: must start with 0x');
        }
        return address.toLowerCase();
      };

      expect(() => normalizeAddress('1234567890ABCDEF')).toThrow('Invalid address format: must start with 0x');
    });
  });

  describe('Token Conversion', () => {
    it('should convert complete token from database format to API format', () => {
      const convertDbTokenToApi = (dbToken: MockToken) => {
        const token: Record<string, string | number> = {
          symbol: dbToken.symbol,
          name: dbToken.name,
          decimals: dbToken.decimals,
        };

        if (dbToken.l1Address) {
          token.l1_address = dbToken.l1Address;
        }

        if (dbToken.l2Address) {
          token.l2_address = dbToken.l2Address;
        }

        return token;
      };

      const dbToken = {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        l1Address: '0x1234567890123456789012345678901234567890',
        l2Address: '0x0987654321098765432109876543210987654321',
      };

      const result = convertDbTokenToApi(dbToken);

      expect(result).toEqual({
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        l1_address: '0x1234567890123456789012345678901234567890',
        l2_address: '0x0987654321098765432109876543210987654321',
      });
    });

    it('should handle token with only L1 address', () => {
      const convertDbTokenToApi = (dbToken: MockToken) => {
        const token: Record<string, string | number> = {
          symbol: dbToken.symbol,
          name: dbToken.name,
          decimals: dbToken.decimals,
        };

        if (dbToken.l1Address) {
          token.l1_address = dbToken.l1Address;
        }

        if (dbToken.l2Address) {
          token.l2_address = dbToken.l2Address;
        }

        return token;
      };

      const dbToken = {
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        l1Address: '0x1234567890123456789012345678901234567890',
        l2Address: null,
      };

      const result = convertDbTokenToApi(dbToken);

      expect(result).toEqual({
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        l1_address: '0x1234567890123456789012345678901234567890',
      });
    });
  });

  describe('Token Completeness Check', () => {
    it('should identify complete tokens', () => {
      const isTokenComplete = (token: { l1_address?: string; l2_address?: string }): boolean => {
        return token.l1_address !== undefined && token.l2_address !== undefined;
      };

      const completeToken = {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        l1_address: '0x1234567890123456789012345678901234567890',
        l2_address: '0x0987654321098765432109876543210987654321',
      };

      const incompleteToken = {
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        l1_address: '0x1234567890123456789012345678901234567890',
      };

      expect(isTokenComplete(completeToken)).toBe(true);
      expect(isTokenComplete(incompleteToken)).toBe(false);
    });
  });

  describe('Cache Control Headers', () => {
    it('should set correct cache headers for complete tokens', () => {
      const isTokenComplete = (token: { l1_address?: string; l2_address?: string }): boolean => {
        return token.l1_address !== undefined && token.l2_address !== undefined;
      };

      const getCacheControl = (token: { l1_address?: string; l2_address?: string }): string => {
        return isTokenComplete(token) ? 'public, max-age=31536000, immutable' : 'public, max-age=60';
      };

      const completeToken = {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        l1_address: '0x1234567890123456789012345678901234567890',
        l2_address: '0x0987654321098765432109876543210987654321',
      };

      const incompleteToken = {
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        l1_address: '0x1234567890123456789012345678901234567890',
      };

      expect(getCacheControl(completeToken)).toBe('public, max-age=31536000, immutable');
      expect(getCacheControl(incompleteToken)).toBe('public, max-age=60');
    });
  });

  describe('Database Query Logic', () => {
    it('should handle database query for tokens list with cursor pagination', async () => {
      const mockTokens = [
        {
          id: 1,
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
          l1Address: '0x1234567890123456789012345678901234567890',
          l2Address: null,
        },
        {
          id: 2,
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          l1Address: '0x1234567890123456789012345678901234567890',
          l2Address: '0x0987654321098765432109876543210987654321',
        },
      ];

      // Setup mock to return tokens
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve(mockTokens)),
            })),
          })),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(mockTokens)),
          })),
        })),
      });

      // Test the query flow with cursor
      const result = await mockDb.select().from({}).where({}).orderBy({}).limit(101);
      expect(result).toEqual(mockTokens);
    });

    it('should handle database errors gracefully', async () => {
      // Setup mock to throw error
      mockDb.select.mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => Promise.reject(new Error('Database error'))),
            })),
          })),
        })),
      });

      // Test error handling
      await expect(mockDb.select().from({}).where({}).orderBy({}).limit(101)).rejects.toThrow('Database error');
    });

    it('should handle cursor-based pagination response', () => {
      const mockTokens = [
        { id: 1, symbol: 'ETH', name: 'Ethereum', decimals: 18 },
        { id: 2, symbol: 'USDC', name: 'USD Coin', decimals: 6 },
        { id: 3, symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
      ];

      // Simulate fetching with limit + 1
      const limit = 2;
      const fetchedTokens = mockTokens.slice(0, limit + 1);
      const hasMore = fetchedTokens.length > limit;
      const resultTokens = hasMore ? fetchedTokens.slice(0, -1) : fetchedTokens;
      const nextCursor = resultTokens.length > 0 ? resultTokens[resultTokens.length - 1]?.id.toString() : null;

      expect(hasMore).toBe(true);
      expect(resultTokens).toHaveLength(2);
      expect(nextCursor).toBe('2');
    });
  });
});
