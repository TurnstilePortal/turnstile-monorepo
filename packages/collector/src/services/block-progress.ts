import { type BlockProgress, blockProgress } from '@turnstile-portal/api-common/schema';
import { eq } from 'drizzle-orm';
import { getDatabase } from '../db.js';
import { logger } from '../utils/logger.js';

export class BlockProgressService {
  private db = getDatabase();

  async getLastScannedBlock(chain: 'L1' | 'L2'): Promise<number> {
    const result = await this.db
      .select({ lastScannedBlock: blockProgress.lastScannedBlock })
      .from(blockProgress)
      .where(eq(blockProgress.chain, chain))
      .limit(1);

    // If no record exists, create one with block 0
    if (result.length === 0) {
      await this.initializeBlockProgress(chain);
      return 0;
    }

    return result[0]?.lastScannedBlock ?? 0;
  }

  async updateLastScannedBlock(chain: 'L1' | 'L2', blockNumber: number): Promise<void> {
    // Check if record exists first
    const existing = await this.db
      .select({ id: blockProgress.id })
      .from(blockProgress)
      .where(eq(blockProgress.chain, chain))
      .limit(1);

    if (existing.length > 0) {
      // Update existing record
      await this.db
        .update(blockProgress)
        .set({
          lastScannedBlock: blockNumber,
          lastScanTimestamp: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(blockProgress.chain, chain));
    } else {
      // Insert new record
      await this.db.insert(blockProgress).values({
        chain,
        lastScannedBlock: blockNumber,
        lastScanTimestamp: new Date(),
      });
    }

    logger.debug(`Updated ${chain} last scanned block to ${blockNumber}`);
  }

  async getProgress(chain: 'L1' | 'L2'): Promise<BlockProgress | null> {
    const result = await this.db.select().from(blockProgress).where(eq(blockProgress.chain, chain)).limit(1);

    return result[0] ?? null;
  }

  private async initializeBlockProgress(chain: 'L1' | 'L2'): Promise<void> {
    await this.db.insert(blockProgress).values({
      chain,
      lastScannedBlock: 0,
      lastScanTimestamp: new Date(),
    });
    logger.debug(`Initialized ${chain} block progress at block 0`);
  }
}
