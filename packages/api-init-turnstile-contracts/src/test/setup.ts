import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import * as schema from '@turnstile-portal/api-common/schema';
import { contractArtifacts, contractInstances } from '@turnstile-portal/api-common/schema';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

export class TestDatabase {
  private pglite: PGlite;
  public db: PgliteDatabase<typeof schema>;

  private constructor(pglite: PGlite, db: PgliteDatabase<typeof schema>) {
    this.pglite = pglite;
    this.db = db;
  }

  static async create(): Promise<TestDatabase> {
    const pglite = new PGlite();
    const db = drizzle(pglite, { schema });

    const migrationsFolder = join(__dirname, '..', '..', '..', 'api-common', 'migrations');
    await migrate(db, { migrationsFolder });

    return new TestDatabase(pglite, db);
  }

  async cleanup(): Promise<void> {
    await this.pglite.close();
  }

  async truncateAll(): Promise<void> {
    await this.db.delete(contractInstances);
    await this.db.delete(contractArtifacts);
  }
}

export async function setupTestDatabase() {
  const testDb = await TestDatabase.create();
  return {
    db: testDb.db,
    cleanup: () => testDb.cleanup(),
    truncate: () => testDb.truncateAll(),
  };
}
