import { char, integer, jsonb, pgTable, serial, timestamp } from 'drizzle-orm/pg-core';
import type { ContractInstantiationData } from '../types.js';

export const contractArtifacts = pgTable('contract_artifacts', {
  id: serial('id').primaryKey(),
  artifactHash: char('artifact_hash', { length: 66 }).notNull().unique(),
  artifact: jsonb('artifact').notNull(),
  contractClassId: char('contract_class_id', { length: 66 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const contractInstances = pgTable('contract_instances', {
  id: serial('id').primaryKey(),
  address: char('address', { length: 66 }).notNull().unique(),
  originalContractClassId: char('original_contract_class_id', { length: 66 }).references(
    () => contractArtifacts.contractClassId,
  ),
  currentContractClassId: char('current_contract_class_id', { length: 66 }).references(
    () => contractArtifacts.contractClassId,
  ),
  initializationHash: char('initialization_hash', { length: 66 }),
  // JSON payload capturing constructor args and public keys used to derive the initialization hash
  deploymentParams: jsonb('deployment_params').$type<ContractInstantiationData>(),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ContractArtifact = typeof contractArtifacts.$inferSelect;
export type NewContractArtifact = typeof contractArtifacts.$inferInsert;

export type ContractInstance = typeof contractInstances.$inferSelect;
export type NewContractInstance = typeof contractInstances.$inferInsert;
