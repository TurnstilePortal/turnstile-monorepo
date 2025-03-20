import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  TurnstileError,
  type ErrorContext,
  createL1Error,
  createL2Error,
  createBridgeError,
  createConfigError,
  createValidationError,
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

describe('Error helper functions', () => {
  it('should create L1 errors with appropriate code validation', () => {
    const validError = createL1Error(
      ErrorCode.L1_TOKEN_OPERATION,
      'Token operation failed',
      { operation: 'transfer' },
    );

    expect(validError.code).toBe(ErrorCode.L1_TOKEN_OPERATION);
    expect(validError.category).toBe('L1');

    expect(() =>
      createL1Error(ErrorCode.L2_GENERAL, 'Invalid code for L1'),
    ).toThrow('Invalid L1 error code');
  });

  it('should create L2 errors with appropriate code validation', () => {
    const validError = createL2Error(
      ErrorCode.L2_SHIELD_OPERATION,
      'Shield operation failed',
      { amount: '100' },
    );

    expect(validError.code).toBe(ErrorCode.L2_SHIELD_OPERATION);
    expect(validError.category).toBe('L2');

    expect(() =>
      createL2Error(ErrorCode.L1_GENERAL, 'Invalid code for L2'),
    ).toThrow('Invalid L2 error code');
  });

  it('should create Bridge errors with appropriate code validation', () => {
    const validError = createBridgeError(
      ErrorCode.BRIDGE_DEPOSIT,
      'Bridge deposit failed',
      { txHash: '0xabc' },
    );

    expect(validError.code).toBe(ErrorCode.BRIDGE_DEPOSIT);
    expect(validError.category).toBe('Bridge');

    expect(() =>
      createBridgeError(ErrorCode.L1_GENERAL, 'Invalid code for Bridge'),
    ).toThrow('Invalid Bridge error code');
  });

  it('should create Config errors with appropriate code validation', () => {
    const validError = createConfigError(
      ErrorCode.CONFIG_MISSING_PARAMETER,
      'Missing required parameter',
      { param: 'apiKey' },
    );

    expect(validError.code).toBe(ErrorCode.CONFIG_MISSING_PARAMETER);
    expect(validError.category).toBe('Config');

    expect(() =>
      createConfigError(ErrorCode.L1_GENERAL, 'Invalid code for Config'),
    ).toThrow('Invalid Config error code');
  });

  it('should create Validation errors with appropriate code validation', () => {
    const validError = createValidationError(
      ErrorCode.VALIDATION_RANGE,
      'Value out of range',
      { value: 101, min: 0, max: 100 },
    );

    expect(validError.code).toBe(ErrorCode.VALIDATION_RANGE);
    expect(validError.category).toBe('Validation');

    expect(() =>
      createValidationError(
        ErrorCode.L1_GENERAL,
        'Invalid code for Validation',
      ),
    ).toThrow('Invalid Validation error code');
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

    const error = new TurnstileError(
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
