export type PollOptions<T> = {
  action: () => Promise<T> | T;
  check: (value: T) => boolean;
  intervalMs?: number;
  timeoutMs?: number;
  onTick?: (value: T) => void;
  onTimeout?: () => Error;
};

export async function poll<T>({
  action,
  check,
  intervalMs = 1_000,
  timeoutMs = 60_000,
  onTick,
  onTimeout,
}: PollOptions<T>): Promise<T> {
  const start = Date.now();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const value = await action();
    onTick?.(value);

    if (check(value)) {
      return value;
    }

    if (Date.now() - start >= timeoutMs) {
      const error = onTimeout?.();
      if (error) {
        throw error;
      }
      throw new Error('Polling timed out');
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
