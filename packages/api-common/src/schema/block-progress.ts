import { bigint, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

export const blockProgress = pgTable('block_progress', {
  id: serial('id').primaryKey(),
  chain: varchar('chain', { length: 10 }).notNull().unique(), // 'L1' or 'L2'
  lastScannedBlock: bigint('last_scanned_block', { mode: 'number' }).notNull().default(0),
  lastScanTimestamp: timestamp('last_scan_timestamp', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type BlockProgress = typeof blockProgress.$inferSelect;
export type NewBlockProgress = typeof blockProgress.$inferInsert;
