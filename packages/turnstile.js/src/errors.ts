/**
 * Numeric error codes for Turnstile operations, grouped by category
 */
export enum ErrorCode {
  // L1 errors (1000-1999)
  L1_GENERAL = 1000,
  L1_TOKEN_OPERATION = 1001,
  L1_WALLET_NOT_CONNECTED = 1002,
  L1_INSUFFICIENT_ALLOWANCE = 1003,
  L1_INSUFFICIENT_BALANCE = 1004,
  L1_CONTRACT_INTERACTION = 1005,
  L1_TRANSACTION_FAILED = 1006,
  L1_LOG_PARSING = 1007,
  L1_TIMEOUT = 1008,

  // L2 errors (2000-2999)
  L2_GENERAL = 2000,
  L2_TOKEN_OPERATION = 2001,
  L2_WALLET_NOT_CONNECTED = 2002,
  L2_INSUFFICIENT_BALANCE = 2003,
  L2_CONTRACT_INTERACTION = 2004,
  L2_TRANSACTION_FAILED = 2005,
  L2_SHIELD_OPERATION = 2006,
  L2_UNSHIELD_OPERATION = 2007,
  L2_BURN_OPERATION = 2008,
  L2_DEPLOYMENT = 2009,

  // Bridge errors (3000-3999)
  BRIDGE_GENERAL = 3000,
  BRIDGE_DEPOSIT = 3001,
  BRIDGE_WITHDRAW = 3002,
  BRIDGE_REGISTER = 3003,
  BRIDGE_CLAIM = 3004,
  BRIDGE_MESSAGE = 3005,

  // Config errors (4000-4999)
  CONFIG_GENERAL = 4000,
  CONFIG_INVALID_PARAMETER = 4001,
  CONFIG_MISSING_PARAMETER = 4002,
  CONFIG_INCOMPATIBLE_VERSION = 4003,

  // Validation errors (5000-5999)
  VALIDATION_GENERAL = 5000,
  VALIDATION_AMOUNT = 5001,
  VALIDATION_ADDRESS = 5002,
  VALIDATION_RANGE = 5003,
  VALIDATION_ACCOUNT = 5004,
  VALIDATION_TYPE = 5005,
  VALIDATION_FORMAT = 5006,
  VALIDATION_REQUIRED = 5007,
}

/**
 * Base error class for all Turnstile errors
 */
/**
 * Interface for strongly typed error context
 */
export interface ErrorContext {
  [key: string]:
    | string
    | number
    | boolean
    | null
    | undefined
    | ErrorContext
    | Array<string | number | boolean | null | undefined | ErrorContext>;
}

export class TurnstileError extends Error {
  /**
   * Creates a new TurnstileError
   * @param code Error code from ErrorCode enum
   * @param message Descriptive error message
   * @param context Additional context details for the error
   * @param cause The underlying cause of the error
   */
  override name = 'TurnstileError';

  readonly code: ErrorCode;
  readonly context: ErrorContext;
  override readonly cause?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    context: ErrorContext = {},
    cause?: unknown,
  ) {
    super(message);
    this.code = code;
    this.context = context;
    this.cause = cause;

    // Preserve stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Gets the error category based on the error code range
   */
  get category(): string {
    if (this.code >= 1000 && this.code < 2000) return 'L1';
    if (this.code >= 2000 && this.code < 3000) return 'L2';
    if (this.code >= 3000 && this.code < 4000) return 'Bridge';
    if (this.code >= 4000 && this.code < 5000) return 'Config';
    if (this.code >= 5000 && this.code < 6000) return 'Validation';
    return 'Unknown';
  }

  /**
   * Creates a string representation of the error including context
   */
  override toString(): string {
    const contextStr = Object.keys(this.context).length
      ? `\nContext: ${JSON.stringify(this.context, null, 2)}`
      : '';

    const causeStr =
      this.cause instanceof Error ? `\nCaused by: ${this.cause.message}` : '';

    return `[${this.name}] (${this.code} - ${this.category}): ${this.message}${contextStr}${causeStr}`;
  }
}

/**
 * Helper function to create a specific L1 error
 */
export function createL1Error(
  code: ErrorCode,
  message: string,
  context: ErrorContext = {},
  cause?: unknown,
): TurnstileError {
  if (code < 1000 || code >= 2000) {
    throw new Error(
      `Invalid L1 error code: ${code}. L1 error codes must be between 1000-1999.`,
    );
  }
  return new TurnstileError(code, message, context, cause);
}

/**
 * Helper function to create a specific L2 error
 */
export function createL2Error(
  code: ErrorCode,
  message: string,
  context: ErrorContext = {},
  cause?: unknown,
): TurnstileError {
  if (code < 2000 || code >= 3000) {
    throw new Error(
      `Invalid L2 error code: ${code}. L2 error codes must be between 2000-2999.`,
    );
  }
  return new TurnstileError(code, message, context, cause);
}

/**
 * Helper function to create a specific Bridge error
 */
export function createBridgeError(
  code: ErrorCode,
  message: string,
  context: ErrorContext = {},
  cause?: unknown,
): TurnstileError {
  if (code < 3000 || code >= 4000) {
    throw new Error(
      `Invalid Bridge error code: ${code}. Bridge error codes must be between 3000-3999.`,
    );
  }
  return new TurnstileError(code, message, context, cause);
}

/**
 * Helper function to create a specific Config error
 */
export function createConfigError(
  code: ErrorCode,
  message: string,
  context: ErrorContext = {},
  cause?: unknown,
): TurnstileError {
  if (code < 4000 || code >= 5000) {
    throw new Error(
      `Invalid Config error code: ${code}. Config error codes must be between 4000-4999.`,
    );
  }
  return new TurnstileError(code, message, context, cause);
}

/**
 * Helper function to create a specific Validation error
 */
export function createValidationError(
  code: ErrorCode,
  message: string,
  context: ErrorContext = {},
  cause?: unknown,
): TurnstileError {
  if (code < 5000 || code >= 6000) {
    throw new Error(
      `Invalid Validation error code: ${code}. Validation error codes must be between 5000-5999.`,
    );
  }
  return new TurnstileError(code, message, context, cause);
}
