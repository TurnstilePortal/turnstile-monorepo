import { bigint, char, integer, pgEnum, pgTable, serial, smallint, timestamp, varchar } from 'drizzle-orm/pg-core';

export const l1AllowListStatusEnum = pgEnum('l1_allow_list_status', ['UNKNOWN', 'PROPOSED', 'ACCEPTED', 'REJECTED']);

export const tokens = pgTable('tokens', {
  id: serial('id').primaryKey(),

  // Token metadata - nullable to support L2 registrations found before L1
  symbol: varchar('symbol', { length: 20 }),
  name: varchar('name', { length: 100 }),
  decimals: smallint('decimals'),

  // Ethereum L1 address (0x + 40 hex chars = 42 total)
  l1Address: char('l1_address', { length: 42 }).unique(),

  // Aztec L2 address (0x + 64 hex chars = 66 total)
  l2Address: char('l2_address', { length: 66 }).unique(),

  // Registration tracking
  l1AllowListStatus: l1AllowListStatusEnum('l1_allow_list_status'),
  l1AllowListProposalTx: varchar('l1_allow_list_proposal_tx', { length: 66 }),
  l1AllowListProposer: varchar('l1_allow_list_proposer', { length: 42 }),
  l1AllowListApprover: varchar('l1_allow_list_approver', { length: 42 }),
  l1AllowListResolutionTx: varchar('l1_allow_list_resolution_tx', { length: 66 }),
  l1RegistrationSubmitter: varchar('l1_portal_registration_submitter', { length: 42 }),
  l1RegistrationBlock: bigint('l1_registration_block', { mode: 'number' }),
  l1ToL2MessageHash: char('l1_to_l2_message_hash', { length: 66 }).unique(),
  l1ToL2MessageIndex: integer('l1_to_l2_message_index'),
  l2RegistrationAvailableBlock: bigint('l2_registration_available_block', { mode: 'number' }),
  l2RegistrationBlock: bigint('l2_registration_block', { mode: 'number' }),
  l2RegistrationSubmitter: varchar('l2_portal_registration_submitter', { length: 66 }),
  l2RegistrationFeePayer: varchar('l2_portal_registration_fee_payer', { length: 66 }),
  l1RegistrationTx: varchar('l1_registration_tx', { length: 66 }),
  l2RegistrationTx: varchar('l2_registration_tx', { length: 66 }),
  l2RegistrationTxIndex: integer('l2_registration_tx_index'),
  l2RegistrationLogIndex: integer('l2_registration_log_index'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Token = typeof tokens.$inferSelect;
export type NewToken = typeof tokens.$inferInsert;
