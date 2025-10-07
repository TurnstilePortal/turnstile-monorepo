import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem');
  return {
    ...actual,
    parseEventLogs: vi.fn(),
  };
});

const viem = await vi.importActual<typeof import('viem')>('viem');
const { prepareDeposit, finalizeDeposit, parseDepositReceipt } = await import('./deposit.js');

const mockedParseEventLogs = (await import('viem')).parseEventLogs as unknown as ReturnType<typeof vi.fn>;

describe('prepareDeposit', () => {
  const portalAddress = '0x0000000000000000000000000000000000000001';
  const tokenAddress = '0x0000000000000000000000000000000000000002';
  const l2Recipient = '0x0000000000000000000000000000000000000000000000000000000000000001';

  let readContract: ReturnType<typeof vi.fn>;
  let publicClient: { readContract: typeof readContract };

  beforeEach(() => {
    readContract = vi.fn().mockResolvedValue(true);
    publicClient = { readContract };
  });

  it('encodes calldata and returns token registration status', async () => {
    const result = await prepareDeposit({
      l1PublicClient: publicClient as unknown as viem.PublicClient,
      portalAddress: portalAddress as viem.Address,
      tokenAddress: tokenAddress as viem.Address,
      amount: 123n,
      l2Recipient: l2Recipient,
    });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: portalAddress,
        functionName: 'registered',
      }),
    );

    expect(result.tokenRegistered).toBe(true);
    expect(result.request).toMatchObject({ to: portalAddress, value: 0n });

    const decoded = viem.decodeFunctionData({
      abi: [
        {
          name: 'deposit',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'token', type: 'address' },
            { name: 'l2Recipient', type: 'bytes32' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [],
        } as const,
      ],
      data: result.calldata,
    });
    expect(decoded.functionName).toBe('deposit');
    expect(decoded.args).toEqual([tokenAddress, l2Recipient, 123n]);
  });

  it('throws for non-positive amounts', async () => {
    await expect(
      prepareDeposit({
        l1PublicClient: publicClient as unknown as viem.PublicClient,
        portalAddress: portalAddress as viem.Address,
        tokenAddress: tokenAddress as viem.Address,
        amount: 0n,
        l2Recipient,
      }),
    ).rejects.toThrow('Deposit amount must be greater than zero');
  });
});

describe('parseDepositReceipt', () => {
  beforeEach(() => {
    mockedParseEventLogs.mockReset();
  });

  it('extracts message details from the deposit and inbox logs', () => {
    mockedParseEventLogs
      .mockReturnValueOnce([
        {
          args: {
            leaf: '0x0101010101010101010101010101010101010101010101010101010101010101',
            index: 1n,
          },
        },
      ] as any)
      .mockReturnValueOnce([
        {
          args: {
            l2BlockNumber: 55n,
          },
        },
      ] as any);

    const receipt = {
      logs: [],
      transactionHash: '0xabc' as const,
    } as viem.TransactionReceipt;

    const parsed = parseDepositReceipt(receipt);
    expect(parsed).toEqual({
      messageHash: '0x0101010101010101010101010101010101010101010101010101010101010101',
      messageIndex: 1n,
      l2BlockNumber: 55,
    });
  });
});

describe('finalizeDeposit', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('polls until the provided predicate returns true', async () => {
    const statuses = ['pending', 'pending', 'finalized'];
    const getStatus = vi.fn(async () => statuses.shift() ?? 'finalized');

    const result = await finalizeDeposit({
      messageClient: { getL1ToL2MessageStatus: getStatus },
      messageHash: '0x123' as const,
      isFinalized: (status) => status === 'finalized',
      pollIntervalMs: 1,
      timeoutMs: 50,
    });

    expect(result).toBe('finalized');
    expect(getStatus).toHaveBeenCalledTimes(3);
  });

  it('throws a Turnstile error when polling fails', async () => {
    const error = new Error('boom');
    const getStatus = vi.fn().mockRejectedValue(error);

    await expect(
      finalizeDeposit({
        messageClient: { getL1ToL2MessageStatus: getStatus },
        messageHash: '0x123' as const,
        isFinalized: () => false,
        pollIntervalMs: 1,
        timeoutMs: 10,
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining('Failed to finalize deposit') });
  });
});
