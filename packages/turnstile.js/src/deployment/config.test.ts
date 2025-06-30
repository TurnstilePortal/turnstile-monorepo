import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadConfig, getDefaultConfig, clearConfigCache } from './config.js';
import { ErrorCode } from '../errors.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as typeof fetch;

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
        aztecTokenContractClassID:
          '0x2fa717d121ca3d6dd87fd94854b97c34ed7a02c67c3f798f22f7d2b8e2be01db',
        aztecPortal:
          '0x140c2f99dae0c673525a02063a5ff01ad9613072f41454b453b00aadcd0af63a',
        serializedAztecPortalInstance:
          '0x0114bd890a9bd3984c8d90f71333bed778e9f85887e694ce2768c6dfa2f3308bac116586dbcc81434e8b0727cbe282be01271886275e347489947af5d1b94618a403e6913295dec4c16f436b2ff320c05a1345d76a11e3abb43561a7fb11c5b58e03e6913295dec4c16f436b2ff320c05a1345d76a11e3abb43561a7fb11c5b58e26c91d39792e29adde0ce53dc7c00cf0a93cd8457fcb1a306135a5a5a6d67f4101498945581e0eb9f8427ad6021184c700ef091d570892c437d12c7d90364bbd170ae506787c5c43d6ca9255d571c10fa9ffa9d141666e290c347c5c9ab7e34400c044b05b6ca83b9c2dbae79cc1135155956a64e136819136e9947fe5e5866c1c1f0ca244c7cd46b682552bff8ae77dea40b966a71de076ec3b7678f2bdb1511b00316144359e9a3ec8e49c1cdb7eeb0cedd190dfd9dc90eea5115aa779e287080ffc74d7a8b0bccb88ac11f45874172f3847eb8b92654aaa58a3d2b8dc7833019c111f36ad3fc1d9b7a7a14344314d2864b94f030594cd67f753ef774a1efb2039907fe37f08d10739255141bb066c506a12f7d1e8dfec21abc58494705b6f',
        aztecShieldGateway:
          '0x21a3d4ec396b4899e04172ca5bc0d624b4cb8d8baaba81c8ded9af7fd2d43b9a',
        serializedShieldGatewayInstance:
          '0x010f144d1597f3c1450f10fc05076ea554c7185c1187a49f1d92e445a437b587e1116586dbcc81434e8b0727cbe282be01271886275e347489947af5d1b94618a401c03a317f19a9589de092f86869be71ca291082e766696ee9eae0828448c6e001c03a317f19a9589de092f86869be71ca291082e766696ee9eae0828448c6e02527af5e18fef2a5c6857d220c31d44dd755cc620e8042d1472a61c200f5d1b0014989455581e0eb9f8427ad6021184c700ef091d570892c437d12c7d90364bbd170ae506787c5c43d6ca9255d571c10fa9ffa9d141666e290c347c5c9ab7e34400c044b05b6ca83b9c2dbae79cc1135155956a64e136819136e9947fe5e5866c1c1f0ca244c7cd46b682552bff8ae77dea40b966a71de076ec3b7678f2bdb1511b00316144359e9a3ec8e49c1cdb7eeb0cedd190dfd9dc90eea5115aa779e287080ffc74d7a8b0bccb88ac11f45874172f3847eb8b92654aaa58a3d2b8dc7833019c111f36ad3fc1d9b7a7a14344314d2864b94f030594cd67f753ef774a1efb2039907fe37f08d10739255141bb066c506a12f7d1e8dfec21abc58494705b6f',
        tokens: {
          DAI: {
            name: 'DAI',
            symbol: 'DAI',
            decimals: 18,
            l1Address: '0x8ce361602b935680e8dec218b820ff5056beb7af',
            l2Address:
              '0x131d3ec54a7f5395c2b67a55f186e4eb0113a60debcc3e541e5b01a639018d02',
            serializedL2TokenInstance:
              '0x01000000000000000000000000000000000000000000000000000000987654321000000000000000000000000000000000000000000000000000000000000000002fa717d121ca3d6dd87fd94854b97c34ed7a02c67c3f798f22f7d2b8e2be01db2fa717d121ca3d6dd87fd94854b97c34ed7a02c67c3f798f22f7d2b8e2be01db259f1125b875267fde53a0bd230608588fcb24146bd20fb2ba1924e41342fa9301498945581e0eb9f8427ad6021184c700ef091d570892c437d12c7d90364bbd170ae506787c5c43d6ca9255d571c10fa9ffa9d141666e290c347c5c9ab7e34400c044b05b6ca83b9c2dbae79cc1135155956a64e136819136e9947fe5e5866c1c1f0ca244c7cd46b682552bff8ae77dea40b966a71de076ec3b7678f2bdb1511b00316144359e9a3ec8e49c1cdb7eeb0cedd190dfd9dc90eea5115aa779e287080ffc74d7a8b0bccb88ac11f45874172f3847eb8b92654aaa58a3d2b8dc7833019c111f36ad3fc1d9b7a7a14344314d2864b94f030594cd67f753ef774a1efb2039907fe37f08d10739255141bb066c506a12f7d1e8dfec21abc58494705b6f',
          },
        },
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockSandboxConfig),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const config = await loadConfig('sandbox');

      expect(fetch).toHaveBeenCalledWith(
        'https://sandbox.aztec.walletmesh.com/api/v1/turnstile/deployment.json',
      );
      expect(config.network.name).toBe('sandbox');
      expect(config.network.description).toBe('Aztec Sandbox Environment');
      expect(config.network.l1ChainId).toBe(11155111);
      expect(config.network.l2ChainId).toBe(1);
      expect(config.network.rpc.l1).toBe(
        'https://sandbox.ethereum.walletmesh.com/api/v1/public',
      );
      expect(config.network.rpc.l2).toBe(
        'https://sandbox.aztec.walletmesh.com/api/v1/public',
      );
      expect(config.network.deployment.l1Portal).toBe(
        '0xa15bb66138824a1c7167f5e85b957d04dd34e468',
      );
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

    it('should throw error when getDefaultConfig is called for sandbox', () => {
      expect(() => getDefaultConfig('sandbox')).toThrow();
      expect(() => getDefaultConfig('sandbox')).toThrow(
        'Sandbox configuration is loaded dynamically from API',
      );
    });
  });

  describe('Other Networks', () => {
    it('should load testnet configuration from default', async () => {
      const config = await loadConfig('testnet');
      expect(config.network.name).toBe('testnet');
      expect(config.network.description).toBe('Aztec Testnet Environment');
    });

    it('should load mainnet configuration from default', async () => {
      const config = await loadConfig('mainnet');
      expect(config.network.name).toBe('mainnet');
      expect(config.network.description).toBe('Aztec Mainnet Environment');
    });

    it('should load local configuration from default', async () => {
      const config = await loadConfig('local');
      expect(config.network.name).toBe('local');
      expect(config.network.description).toBe('Local Development Environment');
    });

    it('should get default config for non-sandbox networks', () => {
      const testnetConfig = getDefaultConfig('testnet');
      expect(testnetConfig.name).toBe('testnet');

      const mainnetConfig = getDefaultConfig('mainnet');
      expect(mainnetConfig.name).toBe('mainnet');

      const localConfig = getDefaultConfig('local');
      expect(localConfig.name).toBe('local');
    });
  });
});
