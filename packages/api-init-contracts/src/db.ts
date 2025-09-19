import type { ContractArtifact } from '@aztec/stdlib/abi';
import { createDbClient, type DbClient } from '@turnstile-portal/api-common';
import type { NewContractArtifact, NewContractInstance } from '@turnstile-portal/api-common/schema';
import { contractArtifacts, contractInstances } from '@turnstile-portal/api-common/schema';
import { eq } from 'drizzle-orm';
import { stripArtifact } from './strip-artifact.js';
import { logger } from './utils/logger.js';

export type { DbClient };

let db: DbClient | null = null;

export function getDatabase(): DbClient {
  if (db) return db;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  logger.debug('Creating database client');
  db = createDbClient(databaseUrl);
  logger.debug('Database client created');
  return db;
}

export async function destroyDatabase(): Promise<void> {
  if (db) {
    logger.debug('Destroying database client');
    const client = (db as { $client?: { end?: () => Promise<void>; ended?: boolean } }).$client;
    if (client && typeof client.end === 'function' && !client.ended) {
      await client.end();
    }
    db = null;
    logger.debug('Database client destroyed');
  }
}

export function setDatabase(database: DbClient | null): void {
  db = database;
}

export async function storeContractArtifact(artifact: NewContractArtifact): Promise<void> {
  const db = getDatabase();

  if (!artifact.artifact || typeof artifact.artifact !== 'object') {
    throw new Error('Contract artifact payload is missing');
  }

  logger.debug(
    { artifactHash: artifact.artifactHash, contractClassId: artifact.contractClassId },
    'Preparing contract artifact for storage',
  );
  const sanitizedArtifact = stripArtifact(artifact.artifact as ContractArtifact);
  const values = { ...artifact, artifact: sanitizedArtifact } satisfies NewContractArtifact;

  await db
    .insert(contractArtifacts)
    .values(values)
    .onConflictDoUpdate({
      target: contractArtifacts.artifactHash,
      set: {
        artifact: sanitizedArtifact,
        contractClassId: artifact.contractClassId,
        updatedAt: new Date(),
      },
    });

  logger.debug(
    { artifactHash: artifact.artifactHash, contractClassId: artifact.contractClassId },
    'Contract artifact stored',
  );
}

export async function storeContractInstance(instance: NewContractInstance): Promise<void> {
  const db = getDatabase();

  logger.debug({ address: instance.address }, 'Storing contract instance');
  await db
    .insert(contractInstances)
    .values(instance)
    .onConflictDoUpdate({
      target: contractInstances.address,
      set: {
        currentContractClassId: instance.currentContractClassId,
        version: instance.version,
        updatedAt: new Date(),
      },
    });

  logger.debug({ address: instance.address }, 'Contract instance stored');
}

export async function getContractArtifactByHash(artifactHash: string) {
  const db = getDatabase();
  logger.debug({ artifactHash }, 'Looking up contract artifact by hash');
  const result = await db
    .select()
    .from(contractArtifacts)
    .where(eq(contractArtifacts.artifactHash, artifactHash))
    .limit(1);

  if (result[0]) {
    logger.debug({ artifactHash }, 'Found existing contract artifact');
  } else {
    logger.debug({ artifactHash }, 'Contract artifact not found');
  }

  return result[0] ?? null;
}

export async function getContractInstanceByAddress(address: string) {
  const db = getDatabase();
  logger.debug({ address }, 'Looking up contract instance by address');
  const result = await db.select().from(contractInstances).where(eq(contractInstances.address, address)).limit(1);

  if (result[0]) {
    logger.debug({ address }, 'Found existing contract instance');
  } else {
    logger.debug({ address }, 'Contract instance not found');
  }

  return result[0] ?? null;
}
