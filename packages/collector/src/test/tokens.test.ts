import { tokens } from '@turnstile-portal/api-common/schema';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupTestDatabase } from './setup.js';

describe('Tokens Database', () => {
  let testDb: Awaited<ReturnType<typeof setupTestDatabase>>;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
  });

  afterAll(async () => {
    await testDb.cleanup();
  });

  beforeEach(async () => {
    await testDb.truncate();
  });

  it('should insert and retrieve a token', async () => {
    // Insert a token
    await testDb.db.insert(tokens).values({
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      l1Address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      l2Address: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Retrieve the token
    const tokenResults = await testDb.db.select().from(tokens);

    expect(tokenResults).toHaveLength(1);
    expect(tokenResults[0]?.symbol).toBe('USDC');
    expect(tokenResults[0]?.decimals).toBe(6);
  });

  it('should handle L2-only tokens', async () => {
    await testDb.db.insert(tokens).values({
      symbol: 'L2TOKEN',
      name: 'L2 Only Token',
      decimals: 18,
      l1Address: null,
      l2Address: `0x${'1'.repeat(64)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = await testDb.db.select().from(tokens).where(eq(tokens.symbol, 'L2TOKEN')).limit(1);

    expect(token[0]).toBeDefined();
    expect(token[0]?.l1Address).toBeNull();
    expect(token[0]?.l2Address).toBeTruthy();
  });

  it('should enforce unique addresses', async () => {
    const l1Address = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

    await testDb.db.insert(tokens).values({
      symbol: 'TOKEN1',
      name: 'Token 1',
      decimals: 18,
      l1Address: l1Address,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Try to insert another token with same L1 address
    await expect(
      testDb.db.insert(tokens).values({
        symbol: 'TOKEN2',
        name: 'Token 2',
        decimals: 18,
        l1Address: l1Address,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).rejects.toThrow();
  });
});
