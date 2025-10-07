import { describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';
import { registerToken } from './token.js';

describe('registerToken', () => {
  const portalAddress = '0x0000000000000000000000000000000000000001';
  const tokenAddress = '0x0000000000000000000000000000000000000002';

  it('loads token metadata when not provided', async () => {
    const readContract = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce('Mock Token')
      .mockResolvedValueOnce('MOCK')
      .mockResolvedValueOnce(18n);

    const publicClient = { readContract } as unknown as PublicClient;

    const prepared = await registerToken({
      l1PublicClient: publicClient,
      portalAddress: portalAddress as any,
      tokenAddress: tokenAddress as any,
    });

    expect(readContract).toHaveBeenCalledTimes(4);
    expect(prepared.metadata).toEqual({ name: 'Mock Token', symbol: 'MOCK', decimals: 18 });
    expect(prepared.request).toMatchObject({ to: portalAddress, value: 0n });
  });

  it('reuses provided metadata', async () => {
    const readContract = vi.fn().mockResolvedValueOnce(true);
    const publicClient = { readContract } as unknown as PublicClient;

    const prepared = await registerToken({
      l1PublicClient: publicClient,
      portalAddress: portalAddress as any,
      tokenAddress: tokenAddress as any,
      metadata: { name: 'Preset', symbol: 'PST', decimals: 8 },
    });

    expect(readContract).toHaveBeenCalledTimes(1);
    expect(prepared.metadata).toEqual({ name: 'Preset', symbol: 'PST', decimals: 8 });
    expect(prepared.tokenRegistered).toBe(true);
  });
});
