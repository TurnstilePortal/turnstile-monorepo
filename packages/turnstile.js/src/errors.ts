/**
 * Enum for all Turnstile error codes
 */
export enum ErrorCode {
  /** Error related to L1 (Ethereum) operations */
  L1_ERROR = 'L1_ERROR',

  /** Error related to L2 (Aztec) operations */
  L2_ERROR = 'L2_ERROR',

  /** Error related to bridge operations between L1 and L2 */
  BRIDGE_ERROR = 'BRIDGE_ERROR',

  /** Error related to configuration */
  CONFIG_ERROR = 'CONFIG_ERROR',

  /** Error related to validation */
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * Factory function to create error classes that extend TurnstileError
 * @param name The name of the error class
 * @param code The error code from ErrorCode enum
 * @returns A class extending TurnstileError with the specified name and code
 */
export function createErrorClass(name: string, code: ErrorCode) {
  return class extends TurnstileError {
    override name = name;

    constructor(message: string, cause?: unknown) {
      super(message, code, cause);
    }
  };
}

/**
 * Base error class for all Turnstile errors
 */
export class TurnstileError extends Error {
  /**
   * Creates a new TurnstileError
   * @param message Error message
   * @param code Error code
   * @param cause Underlying cause of the error
   */
  override name = 'TurnstileError';

  readonly code: string;
  override readonly cause?: unknown;

  constructor(message: string, code: string, cause?: unknown) {
    super(message);
    this.code = code;
    this.cause = cause;

    // Preserve stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown for L1 (Ethereum) related issues
 */
export const L1Error = createErrorClass('L1Error', ErrorCode.L1_ERROR);

/**
 * Error thrown for L2 (Aztec) related issues
 */
export const L2Error = createErrorClass('L2Error', ErrorCode.L2_ERROR);

/**
 * Error thrown for bridge operations between L1 and L2
 */
export const BridgeError = createErrorClass(
  'BridgeError',
  ErrorCode.BRIDGE_ERROR,
);

/**
 * Error thrown for configuration issues
 */
export const ConfigurationError = createErrorClass(
  'ConfigurationError',
  ErrorCode.CONFIG_ERROR,
);

/**
 * Error thrown for validation issues
 */
export const ValidationError = createErrorClass(
  'ValidationError',
  ErrorCode.VALIDATION_ERROR,
);
