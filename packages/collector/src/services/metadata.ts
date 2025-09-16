import { tokens } from '@turnstile-portal/api-common/schema';
import { eq, sql } from 'drizzle-orm';
import { erc20Abi, type PublicClient } from 'viem';
import type { DbClient } from '../db.js';
import { getTokenMetadataByL1Address } from '../db.js';
import { normalizeL1Address } from '../utils/address.js';
import { logger } from '../utils/logger.js';

export class MetadataService {
  private presentCache = new Set<string>();

  constructor(
    private publicClient: PublicClient,
    private db: DbClient,
  ) {}

  /**
   * Ensures token metadata (name/symbol/decimals) exists in DB for the given L1 address.
   * - Uses a simple presence cache to avoid repeated DB checks and duplicate fetches within a single process.
   * - If DB already has complete metadata, returns "present".
   * - Otherwise, optimistically marks the address as present, fetches from chain, and writes with set-if-null semantics.
   *   On failure, removes from cache and returns "failed".
   */
  async ensureTokenMetadata(l1Address: `0x${string}`): Promise<'present' | 'fetched' | 'failed'> {
    const addr = normalizeL1Address(l1Address);

    // If we've already confirmed presence (or are currently fetching), skip work.
    if (this.presentCache.has(addr)) {
      return 'present';
    }

    // DB pre-check for existing metadata (use shared helper so tests can mock easily)
    try {
      const row = await getTokenMetadataByL1Address(addr);
      if (row && row.symbol != null && row.name != null && row.decimals != null) {
        this.presentCache.add(addr);
        return 'present';
      }
    } catch (err) {
      logger.warn(`MetadataService DB pre-check failed for ${l1Address}: ${(err as Error).message}`);
      // Continue to attempt fetch/write
    }

    // Optimistically mark present to avoid duplicate work in this process
    this.presentCache.add(addr);

    try {
      // Fetch from chain
      const [name, symbol, decimalsRaw] = await Promise.all([
        this.publicClient.readContract({
          address: l1Address,
          abi: erc20Abi,
          functionName: 'name',
        }),
        this.publicClient.readContract({
          address: l1Address,
          abi: erc20Abi,
          functionName: 'symbol',
        }),
        this.publicClient.readContract({
          address: l1Address,
          abi: erc20Abi,
          functionName: 'decimals',
        }),
      ]);

      const decimals = Number(decimalsRaw);

      // Ensure a row exists for this address
      await this.db.insert(tokens).values({ l1Address: addr }).onConflictDoNothing({ target: tokens.l1Address });

      // Backfill only-null fields (do not overwrite)
      await this.db
        .update(tokens)
        .set({
          symbol: sql`coalesce(${tokens.symbol}, ${symbol})`,
          name: sql`coalesce(${tokens.name}, ${name})`,
          decimals: sql`coalesce(${tokens.decimals}, ${decimals})`,
          updatedAt: new Date(),
        })
        .where(eq(tokens.l1Address, addr));

      return 'fetched';
    } catch (err) {
      logger.warn(`MetadataService ensureTokenMetadata failed for ${l1Address}: ${(err as Error).message}`);
      // Allow future retries
      this.presentCache.delete(addr);
      return 'failed';
    }
  }
}
