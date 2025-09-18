import { createDbClient, type DbClient } from '@turnstile-portal/api-common';
import type { NewContractArtifact, NewContractInstance } from '@turnstile-portal/api-common/schema';
import { contractArtifacts, contractInstances } from '@turnstile-portal/api-common/schema';
import { eq } from 'drizzle-orm';

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
    if (client && typeof client.end === 'function' && !client.ended) {
      await client.end();
    }
    db = null;
  }
}

export function setDatabase(database: DbClient | null): void {
  db = database;
}

function stripDebugSymbols(artifact: NewContractArtifact['artifact']): NewContractArtifact['artifact'] {
  if (!artifact || typeof artifact !== 'object') {
    return artifact;
  }

  const artifactObject = artifact as Record<string, unknown> & { functions?: unknown };
  const functions = artifactObject.functions;

  if (!Array.isArray(functions)) {
    return artifact;
  }

  let removed = false;
  const sanitizedFunctions = functions.map((fn) => {
    if (!fn || typeof fn !== 'object' || Array.isArray(fn)) {
      return fn;
    }

    const functionObject = fn as Record<string, unknown>;
    if (!Object.hasOwn(functionObject, 'debug_symbols')) {
      return fn;
    }

    removed = true;
    const { debug_symbols: _debugSymbols, ...rest } = functionObject;
    return rest;
  });

  if (!removed) {
    return artifact;
  }

  return {
    ...artifactObject,
    functions: sanitizedFunctions,
  } as typeof artifact;
}

export async function storeContractArtifact(artifact: NewContractArtifact): Promise<void> {
  const db = getDatabase();

  const sanitizedArtifact = stripDebugSymbols(artifact.artifact);
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
        version: instance.version,
        updatedAt: new Date(),
      },
    });
}

export async function getContractArtifactByHash(artifactHash: string) {
  const db = getDatabase();
  const result = await db
    .select()
    .from(contractArtifacts)
    .where(eq(contractArtifacts.artifactHash, artifactHash))
    .limit(1);

  return result[0] ?? null;
}

export async function getContractInstanceByAddress(address: string) {
  const db = getDatabase();
  const result = await db.select().from(contractInstances).where(eq(contractInstances.address, address)).limit(1);

  return result[0] ?? null;
}
