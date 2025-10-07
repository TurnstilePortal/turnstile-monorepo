import { describe, expect, it } from 'vitest';
import { poll } from './poll.js';

describe('poll', () => {
  it('resolves when the predicate passes', async () => {
    let count = 0;
    const result = await poll({
      action: async () => ++count,
      check: (value) => value === 3,
      intervalMs: 1,
      timeoutMs: 50,
    });

    expect(result).toBe(3);
  });

  it('throws the timeout error when exceeded', async () => {
    await expect(
      poll({
        action: async () => 1,
        check: () => false,
        intervalMs: 1,
        timeoutMs: 5,
        onTimeout: () => new Error('Timed out'),
      }),
    ).rejects.toThrow('Timed out');
  });
});
