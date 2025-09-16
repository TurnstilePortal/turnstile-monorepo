import { describe, expect, it, vi } from 'vitest';
import { createDbClient } from '../client.js';

// Mock pg Pool
const mockPool = {
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
};

// Mock drizzle
const mockDrizzle = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('pg', () => ({
  Pool: vi.fn(() => mockPool),
}));

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn(() => mockDrizzle),
}));

describe('Database Client', () => {
  describe('createDbClient', () => {
    it('should create a database client with valid connection string', () => {
      const databaseUrl = 'postgresql://user:password@localhost:5432/testdb';

      const client = createDbClient(databaseUrl);

      expect(client).toBeDefined();
      expect(client).toBe(mockDrizzle);
    });

    it('should create client with different database URL formats', () => {
      const testUrls = [
        'postgresql://localhost/testdb',
        'postgres://user@localhost:5432/testdb',
        'postgresql://user:pass@localhost:5432/testdb?sslmode=require',
      ];

      testUrls.forEach((url) => {
        const client = createDbClient(url);
        expect(client).toBeDefined();
        expect(client).toBe(mockDrizzle);
      });
    });

    it('should return DrizzleORM instance', () => {
      const databaseUrl = 'postgresql://localhost/testdb';
      const client = createDbClient(databaseUrl);

      expect(client).toBe(mockDrizzle);
      expect(client).toHaveProperty('select');
      expect(client).toHaveProperty('insert');
      expect(client).toHaveProperty('update');
      expect(client).toHaveProperty('delete');
    });
  });

  describe('DbClient Type', () => {
    it('should export proper DbClient type', () => {
      const databaseUrl = 'postgresql://localhost/testdb';
      const client = createDbClient(databaseUrl);

      // Test that the client has expected drizzle methods
      expect(client).toHaveProperty('select');
      expect(client).toHaveProperty('insert');
      expect(client).toHaveProperty('update');
      expect(client).toHaveProperty('delete');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid connection strings gracefully', () => {
      const invalidUrl = 'invalid-connection-string';

      // The function should still create a client, but connection will fail later
      expect(() => createDbClient(invalidUrl)).not.toThrow();
    });

    it('should handle empty connection string', () => {
      const emptyUrl = '';

      expect(() => createDbClient(emptyUrl)).not.toThrow();
    });
  });
});
