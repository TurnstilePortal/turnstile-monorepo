import { describe, expect, it } from 'vitest';
import { decodeFunctionData } from 'viem';
import { withdrawToL1 } from './withdraw.js';

describe('withdrawToL1', () => {
  it('encodes withdrawal data for the portal contract', () => {
    const siblingPath = [
      '0x0000000000000000000000000000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000000000000000000000000000002',
    ] as const;

    const prepared = withdrawToL1({
      portalAddress: '0x0000000000000000000000000000000000000001',
      message: '0xdeadbeef' as const,
      l2BlockNumber: 42,
      leafIndex: 5n,
      siblingPath,
    });

    const decoded = decodeFunctionData({
      abi: [
        {
          name: 'withdraw',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: '_data', type: 'bytes' },
            { name: '_l2BlockNumber', type: 'uint256' },
            { name: '_leafIndex', type: 'uint256' },
            { name: '_path', type: 'bytes32[]' },
          ],
          outputs: [],
        } as const,
      ],
      data: prepared.calldata,
    });

    expect(decoded.args).toEqual(['0xdeadbeef', 42n, 5n, siblingPath]);
    expect(prepared.request).toEqual({
      to: '0x0000000000000000000000000000000000000001',
      data: prepared.calldata,
      value: 0n,
    });
  });
});
