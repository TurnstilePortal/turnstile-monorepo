import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import * as schema from '@turnstile-portal/api-common/schema';
import { blockProgress, tokens } from '@turnstile-portal/api-common/schema';
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
    // Create in-memory PGlite instance
    const pglite = new PGlite();

    // Create Drizzle instance with PGlite
    const db = drizzle(pglite, { schema });

    // Run migrations using Drizzle's migrate function
    const migrationsFolder = join(__dirname, '..', '..', '..', 'api-common', 'migrations');
    await migrate(db, { migrationsFolder });

    return new TestDatabase(pglite, db);
  }

  async cleanup(): Promise<void> {
    await this.pglite.close();
  }

  async truncateAll(): Promise<void> {
    await this.db.delete(tokens);
    await this.db.delete(blockProgress);
  }
}

// Vitest setup helper
export async function setupTestDatabase() {
  const testDb = await TestDatabase.create();
  return {
    db: testDb.db,
    cleanup: () => testDb.cleanup(),
    truncate: () => testDb.truncateAll(),
  };
}
