import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '../errors.js';
import { clearConfigCache, loadConfig } from './config.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as typeof fetch;

// Mock fs module for Node.js file operations
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

vi.mock('node:path', () => ({
  resolve: vi.fn((path: string) => path),
}));

describe('Configuration Loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearConfigCache();
  });

  afterEach(() => {
    vi.resetAllMocks();
    clearConfigCache();
  });

  describe('Sandbox Configuration', () => {
    it('should load sandbox configuration from API', async () => {
      const mockSandboxConfig = {
        l1AllowList: '0x700b6a60ce7eaaea56f065753d8dcb9653dbad35',
        l1Portal: '0xa15bb66138824a1c7167f5e85b957d04dd34e468',
        aztecTokenContractClassID: '0x2fa717d121ca3d6dd87fd94854b97c34ed7a02c67c3f798f22f7d2b8e2be01db',
        aztecPortal: '0x140c2f99dae0c673525a02063a5ff01ad9613072f41454b453b00aadcd0af63a',
        serializedAztecPortalInstance: '0x01234...',
        aztecShieldGateway: '0x21a3d4ec396b4899e04172ca5bc0d624b4cb8d8baaba81c8ded9af7fd2d43b9a',
        serializedShieldGatewayInstance: '0x01234...',
        tokens: {
          DAI: {
            name: 'DAI',
            symbol: 'DAI',
            decimals: 18,
            l1Address: '0x8ce361602b935680e8dec218b820ff5056beb7af',
            l2Address: '0x131d3ec54a7f5395c2b67a55f186e4eb0113a60debcc3e541e5b01a639018d02',
            serializedL2TokenInstance: '0x01234...',
          },
        },
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockSandboxConfig),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const config = await loadConfig('sandbox');

      expect(fetch).toHaveBeenCalledWith('https://sandbox.aztec.walletmesh.com/api/v1/turnstile/deployment.json');
      expect(config.network.name).toBe('sandbox');
      expect(config.network.description).toBe('Aztec Sandbox Environment');
      expect(config.network.l1ChainId).toBe(11155111);
      expect(config.network.l2ChainId).toBe(1);
      expect(config.network.rpc.l1).toBe('https://sandbox.ethereum.walletmesh.com/api/v1/public');
      expect(config.network.rpc.l2).toBe('https://sandbox.aztec.walletmesh.com/api/v1/public');
      expect(config.network.deployment.l1Portal).toBe('0xa15bb66138824a1c7167f5e85b957d04dd34e468');
      expect(config.network.deployment.tokens.DAI).toBeDefined();
    });

    it('should throw error when sandbox API fails', async () => {
      const mockResponse = {
        ok: false,
        statusText: 'Not Found',
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(loadConfig('sandbox')).rejects.toMatchObject({
        code: ErrorCode.CONFIG_INVALID_PARAMETER,
        message: 'Failed to load sandbox configuration from API',
      });
    });

    it('should throw error for unsupported network', async () => {
      await expect(loadConfig('testnet')).rejects.toMatchObject({
        code: ErrorCode.CONFIG_MISSING_PARAMETER,
        message: 'Testnet environment is not yet available. Use a URL or file path instead.',
      });
    });
  });

  describe('URL Configuration', () => {
    it('should load configuration from HTTPS URL', async () => {
      const mockConfig = {
        l1AllowList: '0x700b6a60ce7eaaea56f065753d8dcb9653dbad35',
        l1Portal: '0xa15bb66138824a1c7167f5e85b957d04dd34e468',
        aztecTokenContractClassID: '0x2fa717d121ca3d6dd87fd94854b97c34ed7a02c67c3f798f22f7d2b8e2be01db',
        aztecPortal: '0x140c2f99dae0c673525a02063a5ff01ad9613072f41454b453b00aadcd0af63a',
        serializedAztecPortalInstance: '0x01234...',
        aztecShieldGateway: '0x21a3d4ec396b4899e04172ca5bc0d624b4cb8d8baaba81c8ded9af7fd2d43b9a',
        serializedShieldGatewayInstance: '0x01234...',
        tokens: {
          DAI: {
            name: 'DAI',
            symbol: 'DAI',
            decimals: 18,
            l1Address: '0x8ce361602b935680e8dec218b820ff5056beb7af',
            l2Address: '0x131d3ec54a7f5395c2b67a55f186e4eb0113a60debcc3e541e5b01a639018d02',
            serializedL2TokenInstance: '0x01234...',
          },
        },
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockConfig),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const config = await loadConfig('https://example.com/config.json');

      expect(fetch).toHaveBeenCalledWith('https://example.com/config.json');
      expect(config.network.name).toBe('custom');
      expect(config.network.description).toBe('Configuration loaded from URL: https://example.com/config.json');
      expect(config.network.deployment.l1Portal).toBe('0xa15bb66138824a1c7167f5e85b957d04dd34e468');
      expect(config.network.deployment.tokens.DAI).toBeDefined();
    });

    it('should load configuration from HTTP URL', async () => {
      const mockConfig = {
        l1AllowList: '0x123',
        l1Portal: '0x456',
        aztecTokenContractClassID: '0x789',
        aztecPortal: '0xabc',
        serializedAztecPortalInstance: '0xdef',
        aztecShieldGateway: '0x111',
        serializedShieldGatewayInstance: '0x222',
        tokens: {},
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockConfig),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const config = await loadConfig('http://localhost:3000/config.json');

      expect(fetch).toHaveBeenCalledWith('http://localhost:3000/config.json');
      expect(config.network.name).toBe('custom');
      expect(config.network.description).toBe('Configuration loaded from URL: http://localhost:3000/config.json');
    });

    it('should throw error when URL fetch fails', async () => {
      const mockResponse = {
        ok: false,
        statusText: 'Not Found',
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(loadConfig('https://example.com/config.json')).rejects.toMatchObject({
        code: ErrorCode.CONFIG_INVALID_PARAMETER,
        message: 'Failed to load configuration from URL: https://example.com/config.json',
      });
    });
  });

  describe('File Configuration', () => {
    it('should load configuration from local file', async () => {
      const mockConfig = {
        l1AllowList: '0x700b6a60ce7eaaea56f065753d8dcb9653dbad35',
        l1Portal: '0xa15bb66138824a1c7167f5e85b957d04dd34e468',
        aztecTokenContractClassID: '0x2fa717d121ca3d6dd87fd94854b97c34ed7a02c67c3f798f22f7d2b8e2be01db',
        aztecPortal: '0x140c2f99dae0c673525a02063a5ff01ad9613072f41454b453b00aadcd0af63a',
        serializedAztecPortalInstance: '0x01234...',
        aztecShieldGateway: '0x21a3d4ec396b4899e04172ca5bc0d624b4cb8d8baaba81c8ded9af7fd2d43b9a',
        serializedShieldGatewayInstance: '0x01234...',
        tokens: {
          TT1: {
            name: 'Test Token 1',
            symbol: 'TT1',
            decimals: 18,
            l1Address: '0x127a31cc786aec5bc96f395b8d666b8e9c2a516b',
            l2Address: '0x1cc0e07a1596a1791ceb4a80c22c5f3864ac3bb1e21938487cf6ee996b46a8d1',
            serializedL2TokenInstance: '0x01234...',
          },
        },
      };

      const { readFileSync } = await import('node:fs');
      (readFileSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue(JSON.stringify(mockConfig));

      const config = await loadConfig('./config/local/deployment.json');

      expect(readFileSync).toHaveBeenCalledWith('./config/local/deployment.json', 'utf-8');
      expect(config.network.name).toBe('custom');
      expect(config.network.description).toBe('Configuration loaded from file: ./config/local/deployment.json');
      expect(config.network.deployment.l1Portal).toBe('0xa15bb66138824a1c7167f5e85b957d04dd34e468');
      expect(config.network.deployment.tokens.TT1).toBeDefined();
    });

    it('should throw error when file reading fails', async () => {
      const { readFileSync } = await import('node:fs');
      (readFileSync as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(loadConfig('./nonexistent.json')).rejects.toMatchObject({
        code: ErrorCode.CONFIG_INVALID_PARAMETER,
        message: 'Failed to load configuration from file: ./nonexistent.json',
      });
    });

    it('should throw error when file contains invalid JSON', async () => {
      const { readFileSync } = await import('node:fs');
      (readFileSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue('invalid json');

      await expect(loadConfig('./invalid.json')).rejects.toMatchObject({
        code: ErrorCode.CONFIG_INVALID_PARAMETER,
        message: 'Failed to load configuration from file: ./invalid.json',
      });
    });
  });

  describe('Caching', () => {
    it('should cache configuration results', async () => {
      const mockConfig = {
        l1AllowList: '0x123',
        l1Portal: '0x456',
        aztecTokenContractClassID: '0x789',
        aztecPortal: '0xabc',
        serializedAztecPortalInstance: '0xdef',
        aztecShieldGateway: '0x111',
        serializedShieldGatewayInstance: '0x222',
        tokens: {},
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockConfig),
      };

      mockFetch.mockResolvedValue(mockResponse);

      // Load same config twice
      const config1 = await loadConfig('https://example.com/config.json');
      const config2 = await loadConfig('https://example.com/config.json');

      // Should only fetch once due to caching
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(config1).toBe(config2); // Same object reference
    });

    it('should clear cache when requested', async () => {
      const mockConfig = {
        l1AllowList: '0x123',
        l1Portal: '0x456',
        aztecTokenContractClassID: '0x789',
        aztecPortal: '0xabc',
        serializedAztecPortalInstance: '0xdef',
        aztecShieldGateway: '0x111',
        serializedShieldGatewayInstance: '0x222',
        tokens: {},
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockConfig),
      };

      mockFetch.mockResolvedValue(mockResponse);

      // Load config
      await loadConfig('https://example.com/config.json');

      // Clear cache
      clearConfigCache();

      // Load again - should fetch again
      await loadConfig('https://example.com/config.json');

      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
});
