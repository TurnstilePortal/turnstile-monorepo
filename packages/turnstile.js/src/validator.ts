/**
 * Consolidated validation system for Turnstile
 *
 * This module provides a flexible, predicate-based validation system
 * that leverages the new error codes and TurnstileError class.
 */

import { ErrorCode, TurnstileError, type ErrorContext } from './errors.js';

/**
 * Type for validation predicates
 * These are functions that take a value and return a boolean indicating if it's valid
 */
export type Predicate<T> = (value: T) => boolean;

/**
 * Core validation function that checks a value against a predicate
 *
 * @param value The value to validate
 * @param predicate Function that determines if the value is valid
 * @param errorCode Error code to use if validation fails
 * @param errorMessage Message to include in the error if validation fails
 * @param context Additional context for the error
 * @throws TurnstileError if validation fails
 */
export function validate<T>(
  value: T | null | undefined,
  predicate: Predicate<T>,
  errorCode: ErrorCode,
  errorMessage: string,
  context: ErrorContext = {},
): T {
  // Check if value is defined
  if (value === null || value === undefined) {
    throw new TurnstileError(errorCode, errorMessage, {
      ...context,
      issue: 'Value is null or undefined',
    });
  }

  // Check if value satisfies the predicate
  if (!predicate(value)) {
    throw new TurnstileError(errorCode, errorMessage, {
      ...context,
      issue: 'Value failed predicate check',
    });
  }

  return value;
}

/**
 * Validates that a wallet has a connected account
 *
 * @param wallet The wallet to validate
 * @param errorMessage Optional custom error message
 * @param context Optional additional context
 * @throws TurnstileError if wallet has no account
 */
export function validateWallet(
  wallet: { account?: unknown } | null | undefined,
  errorMessage = 'No account connected to wallet',
  context: ErrorContext = {},
): { account: unknown } {
  // First validate that wallet is defined
  if (wallet === null || wallet === undefined) {
    throw new TurnstileError(ErrorCode.VALIDATION_ACCOUNT, errorMessage, {
      ...context,
      issue: 'Wallet is null or undefined',
    });
  }

  // Then validate that it has an account
  if (wallet.account === null || wallet.account === undefined) {
    throw new TurnstileError(ErrorCode.VALIDATION_ACCOUNT, errorMessage, {
      ...context,
      issue: 'No account connected to wallet',
    });
  }

  return wallet as { account: unknown };
}

/**
 * Validates that an address is not empty
 *
 * @param address The address to validate
 * @param errorMessage Optional custom error message
 * @param context Optional additional context
 * @throws TurnstileError if address is empty or invalid
 */
export function validateAddress<A>(
  address: A | null | undefined,
  errorMessage = 'Address is required',
  context: ErrorContext = {},
): A {
  return validate(
    address,
    (addr) => addr !== null && addr !== undefined && addr !== '',
    ErrorCode.VALIDATION_ADDRESS,
    errorMessage,
    context,
  );
}

/**
 * Validates that a number is within a specified range
 *
 * @param value The number to validate
 * @param min Minimum allowed value (inclusive)
 * @param max Maximum allowed value (inclusive)
 * @param errorMessage Optional custom error message
 * @param context Optional additional context
 * @throws TurnstileError if value is out of range
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  errorMessage = `Value must be between ${min} and ${max}`,
  context: ErrorContext = {},
): number {
  return validate(
    value,
    (n) => n >= min && n <= max,
    ErrorCode.VALIDATION_RANGE,
    errorMessage,
    { ...context, min, max },
  );
}

/**
 * Validates that an amount is positive
 *
 * @param amount The amount to validate
 * @param errorMessage Optional custom error message
 * @param context Optional additional context
 * @throws TurnstileError if amount is not positive
 */
export function validatePositiveAmount(
  amount: bigint,
  errorMessage = 'Amount must be positive',
  context: ErrorContext = {},
): bigint {
  return validate(
    amount,
    (n) => n > 0n,
    ErrorCode.VALIDATION_AMOUNT,
    errorMessage,
    context,
  );
}

/**
 * Validates that a string is not empty
 *
 * @param value The string to validate
 * @param errorMessage Optional custom error message
 * @param context Optional additional context
 * @throws TurnstileError if string is empty
 */
export function validateNonEmptyString(
  value: string,
  errorMessage = 'String cannot be empty',
  context: ErrorContext = {},
): string {
  return validate(
    value,
    (s) => s.trim().length > 0,
    ErrorCode.VALIDATION_REQUIRED,
    errorMessage,
    context,
  );
}

/**
 * Validates that a value is defined (not null or undefined)
 *
 * @param value The value to validate
 * @param errorMessage Optional custom error message
 * @param context Optional additional context
 * @throws TurnstileError if value is null or undefined
 */
export function validateDefined<T>(
  value: T | null | undefined,
  errorMessage = 'Value is required',
  context: ErrorContext = {},
): T {
  if (value === null || value === undefined) {
    throw new TurnstileError(ErrorCode.VALIDATION_REQUIRED, errorMessage, {
      ...context,
      issue: 'Value is null or undefined',
    });
  }
  return value;
}

/**
 * Common predicates for validation
 */
export const predicates = {
  /**
   * Checks if a BigInt value is positive
   */
  isPositive: (n: bigint) => n > 0n,

  /**
   * Checks if a number is within a range (inclusive)
   */
  isInRange: (min: number, max: number) => (n: number) => n >= min && n <= max,

  /**
   * Checks if a string is not empty
   */
  isNotEmpty: (s: string) => s.trim().length > 0,

  /**
   * Checks if a string matches a regular expression
   */
  matchesPattern: (pattern: RegExp) => (s: string) => pattern.test(s),

  /**
   * Checks if an array has a specified length
   */
  hasLength:
    (length: number) =>
    <T>(arr: T[]) =>
      arr.length === length,

  /**
   * Checks if a value is defined (not null or undefined)
   */
  isDefined: <T>(value: T | null | undefined): value is T =>
    value !== null && value !== undefined,

  /**
   * Creates a predicate that negates another predicate
   */
  not:
    <T>(predicate: Predicate<T>): Predicate<T> =>
    (value: T) =>
      !predicate(value),

  /**
   * Creates a predicate that combines multiple predicates with AND logic
   */
  and:
    <T>(...predicates: Predicate<T>[]): Predicate<T> =>
    (value: T) =>
      predicates.every((predicate) => predicate(value)),

  /**
   * Creates a predicate that combines multiple predicates with OR logic
   */
  or:
    <T>(...predicates: Predicate<T>[]): Predicate<T> =>
    (value: T) =>
      predicates.some((predicate) => predicate(value)),
};
