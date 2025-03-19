import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import {
  TurnstileError,
  L1Error,
  L2Error,
  BridgeError,
  ConfigurationError,
  ValidationError,
  ErrorCode,
} from './errors.js';

/**
 * Helper function to test TurnstileError classes
 * @param ErrorClass The error class to test
 * @param errorName The expected name of the error
 * @param errorCode The expected code of the error
 * @param baseClasses Additional classes that the error should be an instance of
 */
type Constructor<T> = new (...args: unknown[]) => T;

function testErrorClass<T extends typeof TurnstileError>(
  ErrorClass: T & (new (message: string, cause?: unknown) => InstanceType<T>),
  errorName: string,
  errorCode: string,
  baseClasses: Array<Constructor<unknown>> = [],
) {
  describe(errorName, () => {
    // Mock Error.captureStackTrace to test that branch
    const originalCaptureStackTrace = Error.captureStackTrace;
    let captureStackTraceMock: Mock;

    beforeEach(() => {
      captureStackTraceMock = vi.fn();
      Error.captureStackTrace = captureStackTraceMock;
    });

    afterEach(() => {
      Error.captureStackTrace = originalCaptureStackTrace;
    });

    it(`should create a ${errorName} with the correct properties`, () => {
      const message = `${errorName} message`;
      const cause = new Error('Underlying error');

      // Create error instance with explicit constructor signature
      const error = new ErrorClass(message, cause);

      // Check instanceof for Error, TurnstileError, and the specific error class
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TurnstileError);
      expect(error).toBeInstanceOf(ErrorClass);

      // Check additional base classes if provided
      for (const baseClass of baseClasses) {
        expect(error).toBeInstanceOf(baseClass);
      }

      expect(error.message).toBe(message);
      expect(error.name).toBe(errorName);
      expect(error.code).toBe(errorCode);
      expect(error.cause).toBe(cause);
      expect(captureStackTraceMock).toHaveBeenCalledWith(error, ErrorClass);
    });

    it(`should create a ${errorName} without a cause`, () => {
      const message = `${errorName} message`;

      const error = new ErrorClass(message);

      expect(error.message).toBe(message);
      expect(error.code).toBe(errorCode);
      expect(error.cause).toBeUndefined();
    });
  });
}

describe('TurnstileError', () => {
  // Mock Error.captureStackTrace to test that branch
  const originalCaptureStackTrace = Error.captureStackTrace;
  let captureStackTraceMock: Mock;

  beforeEach(() => {
    captureStackTraceMock = vi.fn();
    Error.captureStackTrace = captureStackTraceMock;
  });

  afterEach(() => {
    Error.captureStackTrace = originalCaptureStackTrace;
  });

  it('should create a basic error with the correct properties', () => {
    const message = 'Test error message';
    const code = 'TEST_ERROR';
    const cause = new Error('Underlying error');

    const error = new TurnstileError(message, code, cause);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(TurnstileError);
    expect(error.message).toBe(message);
    expect(error.name).toBe('TurnstileError');
    expect(error.code).toBe(code);
    expect(error.cause).toBe(cause);
    expect(captureStackTraceMock).toHaveBeenCalledWith(error, TurnstileError);
  });

  it('should create an error without a cause', () => {
    const message = 'Test error message';
    const code = 'TEST_ERROR';

    const error = new TurnstileError(message, code);

    expect(error.message).toBe(message);
    expect(error.code).toBe(code);
    expect(error.cause).toBeUndefined();
  });
});

// Use the helper function to test all error classes
// Using string literals instead of enum values to match the expected string values
testErrorClass(L1Error, 'L1Error', 'L1_ERROR');
testErrorClass(L2Error, 'L2Error', 'L2_ERROR');
testErrorClass(BridgeError, 'BridgeError', 'BRIDGE_ERROR');
testErrorClass(ConfigurationError, 'ConfigurationError', 'CONFIG_ERROR');
testErrorClass(ValidationError, 'ValidationError', 'VALIDATION_ERROR');
