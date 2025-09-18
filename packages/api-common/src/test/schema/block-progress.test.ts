import { describe, expect, it } from 'vitest';
import { type BlockProgress, blockProgress, type NewBlockProgress } from '../../schema/block-progress.js';

describe('block progress schema', () => {
  it('defines block progress columns', () => {
    expect(blockProgress.id).toBeDefined();
    expect(blockProgress.chain).toBeDefined();
    expect(blockProgress.lastScannedBlock).toBeDefined();
    expect(blockProgress.lastScanTimestamp).toBeDefined();
    expect(blockProgress.createdAt).toBeDefined();
    expect(blockProgress.updatedAt).toBeDefined();
  });

  it('uses consistent column names', () => {
    expect(blockProgress.chain.name).toBe('chain');
    expect(blockProgress.lastScannedBlock.name).toBe('last_scanned_block');
    expect(blockProgress.lastScanTimestamp.name).toBe('last_scan_timestamp');
  });

  it('provides BlockProgress types for selects', () => {
    const progress: BlockProgress = {
      id: 1,
      chain: 'L1',
      lastScannedBlock: 1_000_000,
      lastScanTimestamp: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(progress.chain).toBe('L1');
  });

  it('provides NewBlockProgress types for inserts', () => {
    const newProgress: NewBlockProgress = {
      chain: 'L2',
      lastScannedBlock: 500_000,
    };

    expect(newProgress.chain).toBe('L2');
  });
});
