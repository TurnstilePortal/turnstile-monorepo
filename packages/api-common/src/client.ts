import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { Pool } from 'pg';
import * as schema from './schema.js';

export function createDbClient(databaseUrl: string) {
  // Check if it's PGLite for ephemeral/testing
  if (databaseUrl.startsWith('pglite://')) {
    // Extract the path from pglite:// URL
    // pglite:///tmp/test.db -> /tmp/test.db
    const dbPath = databaseUrl.replace('pglite://', '');
    const client = new PGlite(dbPath);
    return drizzlePglite(client, { schema });
  }

  // Default to PostgreSQL
  const pool = new Pool({
    connectionString: databaseUrl,
  });

  return drizzle(pool, { schema });
}

export type DbClient = ReturnType<typeof createDbClient>;
