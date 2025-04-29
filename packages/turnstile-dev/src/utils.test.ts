import { describe, it, expect, vi } from 'vitest';
import { L1Client, L2Client } from '@turnstile-portal/turnstile.js';
import type { AccountWallet, AztecNode, PXE } from '@aztec/aztec.js';
import type {
  PublicClient,
  WalletClient,
  Transport,
  Chain,
  Account,
} from 'viem';

// Mock the imports
vi.mock('@turnstile-portal/turnstile.js');
vi.mock('@aztec/aztec.js');
vi.mock('@aztec/accounts/schnorr');
vi.mock('./keyData.js');
vi.mock('viem/accounts');
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
    const mockPXE = {} as PXE;
    const mockNode = {} as AztecNode;
    const mockL1Config = {
      chain: { id: 1 } as Chain,
      transport: {} as Transport,
    };

    // Mock KeyData
    vi.mocked(readKeyData).mockResolvedValue({
      l1Address: '0x1234' as `0x${string}`,
      l1PrivateKey: '0xabcd' as `0x${string}`,
      l2Address: '0x5678' as `0x${string}`,
      l2EncKey: '0xef01' as `0x${string}`,
      l2SecretKey: '0x2345' as `0x${string}`,
      l2SigningKey: '0x9876' as `0x${string}`,
      l2Salt: '0x6789' as `0x${string}`,
    });

    // Mock L1Client and L2Client constructors
    vi.mocked(L1Client).mockImplementation(
      () => ({ l1: 'client' }) as unknown as L1Client,
    );
    vi.mocked(L2Client).mockImplementation(
      () => ({ l2: 'client' }) as unknown as L2Client,
    );

    // Call the function
    const result = await getClients(
      mockNode,
      mockL1Config,
      'test-key.json',
    );

    // Verify result
    expect(result).toBeDefined();
    expect(result.l1Client).toBeDefined();
    expect(result.l2Client).toBeDefined();
  });
});
