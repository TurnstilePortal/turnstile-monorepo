import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  TurnstileError,
  type ErrorContext,
  createError,
} from './errors.js';

describe('TurnstileError', () => {
  it('should create an error with the correct properties', () => {
    const error = new TurnstileError(
      ErrorCode.L1_GENERAL,
      'Test error message',
      { testKey: 'testValue' },
      new Error('Cause error'),
    );

    expect(error.name).toBe('TurnstileError');
    expect(error.code).toBe(ErrorCode.L1_GENERAL);
    expect(error.message).toBe('Test error message');
    expect(error.context).toEqual({ testKey: 'testValue' });
    expect(error.cause).toBeInstanceOf(Error);
    if (error.cause instanceof Error) {
      expect(error.cause.message).toBe('Cause error');
    }
  });

  it('should create an error without context or cause', () => {
    const error = new TurnstileError(ErrorCode.L2_GENERAL, 'Simple error');

    expect(error.code).toBe(ErrorCode.L2_GENERAL);
    expect(error.message).toBe('Simple error');
    expect(error.context).toEqual({});
    expect(error.cause).toBeUndefined();
  });

  it('should return the correct category based on error code', () => {
    const l1Error = new TurnstileError(
      ErrorCode.L1_TOKEN_OPERATION,
      'L1 error',
    );
    const l2Error = new TurnstileError(
      ErrorCode.L2_TOKEN_OPERATION,
      'L2 error',
    );
    const bridgeError = new TurnstileError(
      ErrorCode.BRIDGE_DEPOSIT,
      'Bridge error',
    );
    const configError = new TurnstileError(
      ErrorCode.CONFIG_INVALID_PARAMETER,
      'Config error',
    );
    const validationError = new TurnstileError(
      ErrorCode.VALIDATION_AMOUNT,
      'Validation error',
    );

    expect(l1Error.category).toBe('L1');
    expect(l2Error.category).toBe('L2');
    expect(bridgeError.category).toBe('Bridge');
    expect(configError.category).toBe('Config');
    expect(validationError.category).toBe('Validation');
  });

  it('should format toString with context and cause', () => {
    const error = new TurnstileError(
      ErrorCode.VALIDATION_ADDRESS,
      'Invalid address',
      { address: '0x123', expected: 'valid hex' },
      new Error('Parse error'),
    );

    const errorString = error.toString();

    expect(errorString).toContain('[TurnstileError]');
    expect(errorString).toContain(
      `(${ErrorCode.VALIDATION_ADDRESS} - Validation)`,
    );
    expect(errorString).toContain('Invalid address');
    expect(errorString).toContain('Context:');
    expect(errorString).toContain('"address": "0x123"');
    expect(errorString).toContain('"expected": "valid hex"');
    expect(errorString).toContain('Caused by: Parse error');
  });

  it('should format toString without context or cause', () => {
    const error = new TurnstileError(
      ErrorCode.L1_TIMEOUT,
      'Operation timed out',
    );
    const errorString = error.toString();

    expect(errorString).toContain('[TurnstileError]');
    expect(errorString).toContain(`(${ErrorCode.L1_TIMEOUT} - L1)`);
    expect(errorString).toContain('Operation timed out');
    expect(errorString).not.toContain('Context:');
    expect(errorString).not.toContain('Caused by:');
  });
});

describe('createError function', () => {
  it('should create errors with any error code without validation', () => {
    // Test L1 error codes
    const l1Error = createError(
      ErrorCode.L1_TOKEN_OPERATION,
      'Token operation failed',
      { operation: 'transfer' },
    );

    expect(l1Error.code).toBe(ErrorCode.L1_TOKEN_OPERATION);
    expect(l1Error.category).toBe('L1');
    expect(l1Error.message).toBe('Token operation failed');
    expect(l1Error.context).toEqual({ operation: 'transfer' });

    // Test L2 error codes
    const l2Error = createError(
      ErrorCode.L2_SHIELD_OPERATION,
      'Shield operation failed',
      { amount: '100' },
    );

    expect(l2Error.code).toBe(ErrorCode.L2_SHIELD_OPERATION);
    expect(l2Error.category).toBe('L2');

    // Test Bridge error codes
    const bridgeError = createError(
      ErrorCode.BRIDGE_DEPOSIT,
      'Bridge deposit failed',
      { txHash: '0xabc' },
    );

    expect(bridgeError.code).toBe(ErrorCode.BRIDGE_DEPOSIT);
    expect(bridgeError.category).toBe('Bridge');

    // Test Config error codes
    const configError = createError(
      ErrorCode.CONFIG_MISSING_PARAMETER,
      'Missing required parameter',
      { param: 'apiKey' },
    );

    expect(configError.code).toBe(ErrorCode.CONFIG_MISSING_PARAMETER);
    expect(configError.category).toBe('Config');

    // Test Validation error codes
    const validationError = createError(
      ErrorCode.VALIDATION_RANGE,
      'Value out of range',
      { value: 101, min: 0, max: 100 },
    );

    expect(validationError.code).toBe(ErrorCode.VALIDATION_RANGE);
    expect(validationError.category).toBe('Validation');
  });

  it('should allow cross-category error code usage (no range restrictions)', () => {
    // This was previously impossible with the old helper functions
    // Now we can use any error code with any operation context

    // L1 operation that encounters a bridge-related error
    const l1BridgeError = createError(
      ErrorCode.BRIDGE_WITHDRAW,
      'L1 operation encountered bridge withdrawal error',
      { operation: 'l1-withdraw' },
    );

    expect(l1BridgeError.code).toBe(ErrorCode.BRIDGE_WITHDRAW);
    expect(l1BridgeError.category).toBe('Bridge');

    // L2 operation that encounters a validation error
    const l2ValidationError = createError(
      ErrorCode.VALIDATION_ADDRESS,
      'L2 operation encountered validation error',
      { operation: 'l2-transfer' },
    );

    expect(l2ValidationError.code).toBe(ErrorCode.VALIDATION_ADDRESS);
    expect(l2ValidationError.category).toBe('Validation');
  });

  it('should create errors without context or cause', () => {
    const error = createError(ErrorCode.L1_GENERAL, 'Simple error');

    expect(error.code).toBe(ErrorCode.L1_GENERAL);
    expect(error.message).toBe('Simple error');
    expect(error.context).toEqual({});
    expect(error.cause).toBeUndefined();
  });

  it('should support complex nested context objects', () => {
    const context: ErrorContext = {
      operation: 'transfer',
      details: {
        fromAccount: '0x123',
        toAccount: '0x456',
        amounts: [100, 200, 300],
        metadata: {
          network: 'mainnet',
          timestamp: 1612345678,
        },
      },
      success: false,
      attempts: 3,
    };

    const error = createError(
      ErrorCode.L1_TOKEN_OPERATION,
      'Complex error with nested context',
      context,
    );

    expect(error.context).toEqual(context);
    const errorString = error.toString();
    expect(errorString).toContain('fromAccount');
    expect(errorString).toContain('metadata');
    expect(errorString).toContain('mainnet');
  });
});
