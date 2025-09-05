import { L1Client, L2Client } from '@turnstile-portal/turnstile.js';
import type { Chain, Transport } from 'viem';
import { describe, expect, it, vi } from 'vitest';

// Mock the imports
vi.mock('@turnstile-portal/turnstile.js');
vi.mock('@aztec/aztec.js', () => {
  return {
    createAztecNodeClient: vi.fn(() => ({
      getL1ContractAddresses: vi.fn().mockResolvedValue({
        registryAddress: '0x1234',
        inboxAddress: '0x5678',
        outboxAddress: '0x9abc',
        availabilityOracleAddress: '0xdef0',
        rollupAddress: '0x1111',
        gasTokenAddress: '0x2222',
        gasPortalAddress: '0x3333',
      }),
      getNodeInfo: vi.fn().mockResolvedValue({
        rollupAddress: '0x1111',
        l1ChainId: 31337,
        rollupVersion: 1,
      }),
      waitFor: vi.fn().mockResolvedValue(true),
    })),
    waitForNode: vi.fn().mockResolvedValue(true),
    createPXEClient: vi.fn().mockResolvedValue({}),
    waitForPXE: vi.fn().mockResolvedValue(true),
    Fr: {
      fromString: vi.fn().mockReturnValue({}),
      fromHexString: vi.fn().mockReturnValue({}),
      ZERO: {},
    },
    GrumpkinScalar: {
      fromString: vi.fn().mockReturnValue({}),
    },
    loadContractArtifact: vi.fn().mockReturnValue({
      name: 'TestContract',
      functions: [],
    }),
    ContractBase: vi.fn(),
    Contract: vi.fn(),
    BatchCall: vi.fn(),
  };
});
vi.mock('@aztec/accounts/schnorr', () => ({
  getSchnorrAccount: vi.fn().mockReturnValue({
    register: vi.fn().mockResolvedValue({}),
  }),
  getSchnorrWallet: vi.fn().mockResolvedValue({}),
}));
vi.mock('@aztec/pxe/server', () => ({
  createPXEService: vi.fn().mockResolvedValue({
    getPXEInfo: vi.fn().mockResolvedValue({}),
  }),
  getPXEServiceConfig: vi.fn().mockReturnValue({}),
}));
vi.mock('@aztec/kv-store/lmdb', () => ({
  createStore: vi.fn().mockResolvedValue({}),
}));
vi.mock('@aztec/accounts/testing', () => ({
  getDeployedTestAccountsWallets: vi.fn().mockResolvedValue([]),
}));
vi.mock('@aztec/stdlib/keys', () => ({
  deriveSigningKey: vi.fn().mockReturnValue({}),
}));
vi.mock('./keyData.js');
vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn().mockReturnValue({
    address: '0x1234',
  }),
}));
vi.mock('viem', () => {
  return {
    createPublicClient: vi.fn(),
    createWalletClient: vi.fn(),
    http: vi.fn(),
    defineChain: vi.fn(),
  };
});

describe('Turnstile Dev Utils', () => {
  it('getClients test should pass', async () => {
    // Import these here to avoid hoisting issues with vi.mock
    const { getClients } = await import('./utils.js');
    const { readKeyData } = await import('./keyData.js');

    // Setup mocks
    const mockL1Config = {
      chain: { id: 1 } as Chain,
      transport: {} as Transport,
    };

    // Mock KeyData
    vi.mocked(readKeyData).mockResolvedValue({
      l1Address: '0x1234' as `0x${string}`,
      l1PrivateKey: '0xabcd' as `0x${string}`,
      l2Address: '0x5678' as `0x${string}`,
      l2SecretKey: '0x2345' as `0x${string}`,
      l2SigningKey: '0x9876' as `0x${string}`,
      l2Salt: '0x6789' as `0x${string}`,
    });

    // Mock L1Client and L2Client constructors
    vi.mocked(L1Client).mockImplementation(() => ({ l1: 'client' }) as unknown as L1Client);
    vi.mocked(L2Client).mockImplementation(() => ({ l2: 'client' }) as unknown as L2Client);

    // Call the function
    const result = await getClients({ node: 'node' }, mockL1Config, 'test-key.json');

    // Verify result
    expect(result).toBeDefined();
    expect(result.l1Client).toBeDefined();
    expect(result.l2Client).toBeDefined();
  });
});
