import { beforeEach, vi } from 'vitest';
import { mockLogger } from './src/test/mocks/logger.js';

// Mock the logger module globally for all tests
vi.mock('./src/utils/logger.js', () => ({
  logger: mockLogger,
  default: mockLogger,
}));

// Clear logger mocks before each test
beforeEach(() => {
  mockLogger.trace.mockClear();
  mockLogger.debug.mockClear();
  mockLogger.info.mockClear();
  mockLogger.warn.mockClear();
  mockLogger.error.mockClear();
  mockLogger.fatal.mockClear();
});
