import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contractArtifacts, contractInstances } from '@turnstile-portal/api-common/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setDatabase } from '../db.js';
import * as util from '../factory.js';
import { loadTurnstileContracts } from '../loader.js';
import { setupTestDatabase } from './setup.js';

// Load test deployment data
const testDeploymentData = JSON.parse(readFileSync(join(__dirname, 'deployment.json'), 'utf-8'));

describe('loader', () => {
  let testDb: Awaited<ReturnType<typeof setupTestDatabase>>;

  beforeEach(async () => {
    testDb = await setupTestDatabase();
    setDatabase(testDb.db);
    // Set test deployment data to avoid network calls
    util.setDeploymentData(testDeploymentData);
  });

  afterEach(async () => {
    await testDb.cleanup();
    setDatabase(null);
    // Reset factory to clean state
    util.resetFactory();
  });

  describe('loadTurnstileContracts', () => {
    it('should load contract artifacts and instances', async () => {
      const result = await loadTurnstileContracts();

      expect(result.artifactsStored).toBe(3);
      expect(result.instancesStored).toBe(2);

      const artifacts = await testDb.db.select().from(contractArtifacts);
      expect(artifacts).toHaveLength(3);

      const instances = await testDb.db.select().from(contractInstances);
      expect(instances).toHaveLength(2);

      // Verify that artifacts were stored (we don't need to check specific hashes)
      expect(artifacts.some((a) => a.contractClassId)).toBe(true);
      expect(instances.some((i) => i.address)).toBe(true);
    });

    it('should skip existing artifacts and instances', async () => {
      // First run to load all data
      const firstResult = await loadTurnstileContracts();
      expect(firstResult.artifactsStored).toBe(3);
      expect(firstResult.instancesStored).toBe(2);

      // Second run should skip existing data
      const secondResult = await loadTurnstileContracts();
      expect(secondResult.artifactsStored).toBe(0);
      expect(secondResult.instancesStored).toBe(0);

      // Total should still be the same
      const artifacts = await testDb.db.select().from(contractArtifacts);
      expect(artifacts).toHaveLength(3);

      const instances = await testDb.db.select().from(contractInstances);
      expect(instances).toHaveLength(2);
    });
  });
});
