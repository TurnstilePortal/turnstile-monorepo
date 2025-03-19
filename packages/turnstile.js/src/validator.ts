/**
 * Common validation utilities for turnstile.js
 */

/**
 * Validates that an account is connected to a wallet
 * @param walletClient The wallet client to validate
 * @param errorConstructor Constructor for error to throw if validation fails
 * @param errorMessage Error message to use
 * @throws If wallet has no account
 */
export function validateAccount<E extends Error>(
  walletClient: { account: unknown } | null | undefined,
  errorConstructor: new (message: string) => E,
  errorMessage: string,
): void {
  if (!walletClient || !walletClient.account) {
    throw new errorConstructor(errorMessage);
  }
}

/**
 * Validates that an address is not empty
 * @param address The address to validate
 * @param errorConstructor Constructor for error to throw if validation fails
 * @param errorMessage Error message to use
 * @throws If address is empty
 */
export function validateAddress<A, E extends Error>(
  address: A | null | undefined,
  errorConstructor: new (message: string) => E,
  errorMessage: string,
): void {
  if (!address) {
    throw new errorConstructor(errorMessage);
  }
}

/**
 * Validates that a value is within a range
 * @param value The value to validate
 * @param min The minimum allowed value (inclusive)
 * @param max The maximum allowed value (inclusive)
 * @param errorConstructor Constructor for error to throw if validation fails
 * @param errorMessage Error message to use
 * @throws If value is out of range
 */
export function validateRange<E extends Error>(
  value: number,
  min: number,
  max: number,
  errorConstructor: new (message: string) => E,
  errorMessage: string,
): void {
  if (value < min || value > max) {
    throw new errorConstructor(errorMessage);
  }
}

/**
 * Validates that an amount is positive
 * @param amount The amount to validate
 * @param errorConstructor Constructor for error to throw if validation fails
 * @param errorMessage Error message to use
 * @throws If amount is not positive
 */
export function validatePositiveAmount<E extends Error>(
  amount: bigint,
  errorConstructor: new (message: string) => E,
  errorMessage: string,
): void {
  if (amount <= 0n) {
    throw new errorConstructor(errorMessage);
  }
}

/**
 * Checks if a value is defined (not null or undefined)
 * @param value The value to check
 * @returns True if the value is defined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
