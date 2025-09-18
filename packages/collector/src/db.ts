import { createDbClient, type DbClient } from '@turnstile-portal/api-common';
import type { NewContractArtifact, NewContractInstance, NewToken } from '@turnstile-portal/api-common/schema';
import { contractArtifacts, contractInstances, tokens } from '@turnstile-portal/api-common/schema';
import { eq } from 'drizzle-orm';
import { logger } from './utils/logger.js';

// Export DbClient type for other modules to use
export type { DbClient };

let db: DbClient | null = null;

export function getDatabase(): DbClient {
  if (db) return db;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  db = createDbClient(databaseUrl);
  return db;
}

export async function destroyDatabase(): Promise<void> {
  if (db) {
    const client = (db as { $client?: { end?: () => Promise<void>; ended?: boolean } }).$client;
    // Check if it's a PostgreSQL Pool that needs closing
    if (client && typeof client.end === 'function' && !client.ended) {
      await client.end();
    }
    // For PGLite, no explicit close needed
    db = null;
  }
}

// For testing purposes - allows setting a custom database instance
export function setDatabase(database: DbClient | null): void {
  db = database;
}

export async function getTokenMetadataByL1Address(
  l1Address: string,
): Promise<{ symbol: string | null; name: string | null; decimals: number | null } | null> {
  const db = getDatabase();
  const result = await db
    .select({
      symbol: tokens.symbol,
      name: tokens.name,
      decimals: tokens.decimals,
    })
    .from(tokens)
    .where(eq(tokens.l1Address, l1Address))
    .limit(1);

  return result[0] ?? null;
}

export async function storeL1TokenRegistrations(registrations: NewToken[]): Promise<void> {
  if (registrations.length === 0) return;
  const db = getDatabase();

  for (const registration of registrations) {
    // MetadataService ensures token exists with metadata, so we just update registration fields
    await db
      .update(tokens)
      .set({
        l1RegistrationBlock: registration.l1RegistrationBlock,
        l1RegistrationTx: registration.l1RegistrationTx,
        l1RegistrationSubmitter: registration.l1RegistrationSubmitter,
        l2RegistrationAvailableBlock: registration.l2RegistrationAvailableBlock,
        updatedAt: new Date(),
      })
      .where(eq(tokens.l1Address, registration.l1Address as string));
  }
  logger.info(`Stored ${registrations.length} L1 token registrations.`);
}

export async function storeL1TokenAllowListEvents(allowListEvents: NewToken[]): Promise<void> {
  if (allowListEvents.length === 0) return;
  const db = getDatabase();

  for (const event of allowListEvents) {
    if (!event.l1Address) {
      logger.warn({ event }, 'Skipping allowlist event with no L1 address');
      continue;
    }

    // MetadataService ensures token exists with metadata, so we just update allowlist fields
    await db
      .update(tokens)
      .set({
        l1AllowListStatus: event.l1AllowListStatus,
        l1AllowListProposalTx: event.l1AllowListProposalTx,
        l1AllowListProposer: event.l1AllowListProposer,
        l1AllowListResolutionTx: event.l1AllowListResolutionTx,
        l1AllowListApprover: event.l1AllowListApprover,
        updatedAt: new Date(),
      })
      .where(eq(tokens.l1Address, event.l1Address));
  }
  logger.info(`Stored ${allowListEvents.length} L1 token allowlist events.`);
}

export async function storeL2TokenRegistrations(registrations: Partial<NewToken>[]): Promise<void> {
  if (registrations.length === 0) return;
  const db = getDatabase();

  for (const registration of registrations) {
    if (!registration.l1Address) {
      logger.warn({ registration }, 'Skipping L2 registration with no L1 address');
      continue;
    }
    // MetadataService ensures token exists with metadata, so we just update L2 registration fields
    await db
      .update(tokens)
      .set({
        l2Address: registration.l2Address,
        l2RegistrationBlock: registration.l2RegistrationBlock,
        l2RegistrationTxIndex: registration.l2RegistrationTxIndex,
        l2RegistrationLogIndex: registration.l2RegistrationLogIndex,
        l2RegistrationTx: registration.l2RegistrationTx,
        l2RegistrationFeePayer: registration.l2RegistrationFeePayer,
        l2RegistrationSubmitter: registration.l2RegistrationSubmitter,
        updatedAt: new Date(),
      })
      .where(eq(tokens.l1Address, registration.l1Address));
  }
  logger.info(`Stored ${registrations.length} L2 token registrations.`);
}

export async function getOrCreateTokenContractArtifact(
  artifactHash: string,
  contractClassId: string,
  artifact: unknown,
): Promise<void> {
  const db = getDatabase();

  const existing = await db
    .select()
    .from(contractArtifacts)
    .where(eq(contractArtifacts.artifactHash, artifactHash))
    .limit(1);

  if (existing[0]) {
    return;
  }

  const newArtifact: NewContractArtifact = {
    artifactHash,
    artifact,
    contractClassId,
  };

  await db
    .insert(contractArtifacts)
    .values(newArtifact)
    .onConflictDoUpdate({
      target: contractArtifacts.artifactHash,
      set: {
        artifact: newArtifact.artifact,
        contractClassId: newArtifact.contractClassId,
        updatedAt: new Date(),
      },
    });

  logger.info(`Stored contract artifact with hash: ${artifactHash}`);
}

export async function storeContractInstance(instance: NewContractInstance): Promise<void> {
  const db = getDatabase();

  await db
    .insert(contractInstances)
    .values(instance)
    .onConflictDoUpdate({
      target: contractInstances.address,
      set: {
        currentContractClassId: instance.currentContractClassId,
        deploymentParams: instance.deploymentParams,
        version: instance.version,
        updatedAt: new Date(),
      },
    });

  logger.info(`Stored contract instance at address: ${instance.address}`);
}

export async function getContractInstanceByAddress(address: string) {
  const db = getDatabase();
  const result = await db.select().from(contractInstances).where(eq(contractInstances.address, address)).limit(1);

  return result[0] ?? null;
}
