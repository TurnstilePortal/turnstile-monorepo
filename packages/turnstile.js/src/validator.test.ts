import { describe, expect, it } from 'vitest';
import { ErrorCode, TurnstileError } from './errors.js';
import {
  predicates,
  validate,
  validateAddress,
  validateDefined,
  validateNonEmptyString,
  validatePositiveAmount,
  validateRange,
  validateWallet,
} from './validator.js';

describe('Validator Core', () => {
  it('should allow valid values that pass a predicate', () => {
    const result = validate(10, (n) => n > 5, ErrorCode.VALIDATION_GENERAL, 'Number too small');
    expect(result).toBe(10);
  });

  it('should throw for null or undefined values', () => {
    expect(() => {
      validate(null, () => true, ErrorCode.VALIDATION_GENERAL, 'Value is null');
    }).toThrow(TurnstileError);

    expect(() => {
      validate(undefined, () => true, ErrorCode.VALIDATION_GENERAL, 'Value is undefined');
    }).toThrow(TurnstileError);
  });

  it('should throw if the predicate returns false', () => {
    expect(() => {
      validate(3, (n) => n > 5, ErrorCode.VALIDATION_GENERAL, 'Number too small');
    }).toThrow(TurnstileError);

    const error = getErrorFromValidation(() => {
      validate(3, (n) => n > 5, ErrorCode.VALIDATION_GENERAL, 'Number too small');
    });

    expect(error.code).toBe(ErrorCode.VALIDATION_GENERAL);
    expect(error.message).toBe('Number too small');
    expect(error.context.issue).toBe('Value failed predicate check');
  });

  it('should include additional context in errors', () => {
    const context = { min: 5, max: 10, source: 'test' };

    const error = getErrorFromValidation(() => {
      validate(3, (n) => n > 5, ErrorCode.VALIDATION_GENERAL, 'Number too small', context);
    });

    expect(error.context.min).toBe(5);
    expect(error.context.max).toBe(10);
    expect(error.context.source).toBe('test');
  });
});

describe('Specialized Validators', () => {
  describe('validateWallet', () => {
    it('should validate a wallet with an account', () => {
      const wallet = { account: { address: '0x123' } };
      const result = validateWallet(wallet);
      expect(result).toBe(wallet);
    });

    it('should throw for null or undefined wallet', () => {
      expect(() => {
        validateWallet(null);
      }).toThrow(TurnstileError);

      expect(() => {
        validateWallet(undefined);
      }).toThrow(TurnstileError);

      const error = getErrorFromValidation(() => {
        validateWallet(null);
      });

      expect(error.code).toBe(ErrorCode.VALIDATION_ACCOUNT);
      expect(error.context.issue).toBe('Wallet is null or undefined');
    });

    it('should throw if wallet has no account', () => {
      expect(() => {
        validateWallet({});
      }).toThrow(TurnstileError);

      expect(() => {
        validateWallet({ account: null });
      }).toThrow(TurnstileError);

      expect(() => {
        validateWallet({ account: undefined });
      }).toThrow(TurnstileError);

      const error = getErrorFromValidation(() => {
        validateWallet({});
      });

      expect(error.code).toBe(ErrorCode.VALIDATION_ACCOUNT);
      expect(error.context.issue).toBe('No account connected to wallet');
    });

    it('should support custom error message', () => {
      const error = getErrorFromValidation(() => {
        validateWallet({}, 'Custom wallet error');
      });

      expect(error.message).toBe('Custom wallet error');
    });
  });

  describe('validateAddress', () => {
    it('should validate a non-empty address', () => {
      const address = '0x123456';
      const result = validateAddress(address);
      expect(result).toBe(address);
    });

    it('should throw for null, undefined, or empty address', () => {
      expect(() => validateAddress(null)).toThrow(TurnstileError);
      expect(() => validateAddress(undefined)).toThrow(TurnstileError);
      expect(() => validateAddress('')).toThrow(TurnstileError);

      const error = getErrorFromValidation(() => validateAddress(''));
      expect(error.code).toBe(ErrorCode.VALIDATION_ADDRESS);
    });
  });

  describe('validateRange', () => {
    it('should validate a number within range', () => {
      expect(validateRange(5, 1, 10)).toBe(5);
      expect(validateRange(1, 1, 10)).toBe(1); // Min value
      expect(validateRange(10, 1, 10)).toBe(10); // Max value
    });

    it('should throw for numbers outside range', () => {
      expect(() => validateRange(0, 1, 10)).toThrow(TurnstileError);
      expect(() => validateRange(11, 1, 10)).toThrow(TurnstileError);

      const error = getErrorFromValidation(() => validateRange(0, 1, 10));
      expect(error.code).toBe(ErrorCode.VALIDATION_RANGE);
      expect(error.context.min).toBe(1);
      expect(error.context.max).toBe(10);
    });

    it('should use default error message with range values', () => {
      const error = getErrorFromValidation(() => validateRange(0, 1, 10));
      expect(error.message).toBe('Value must be between 1 and 10');
    });
  });

  describe('validatePositiveAmount', () => {
    it('should validate positive BigInt values', () => {
      expect(validatePositiveAmount(1n)).toBe(1n);
      expect(validatePositiveAmount(BigInt(Number.MAX_SAFE_INTEGER))).toBe(BigInt(Number.MAX_SAFE_INTEGER));
    });

    it('should throw for zero or negative values', () => {
      expect(() => validatePositiveAmount(0n)).toThrow(TurnstileError);
      expect(() => validatePositiveAmount(-1n)).toThrow(TurnstileError);

      const error = getErrorFromValidation(() => validatePositiveAmount(0n));
      expect(error.code).toBe(ErrorCode.VALIDATION_AMOUNT);
    });
  });

  describe('validateNonEmptyString', () => {
    it('should validate non-empty strings', () => {
      expect(validateNonEmptyString('test')).toBe('test');
      expect(validateNonEmptyString(' test ')).toBe(' test ');
    });

    it('should throw for empty strings or whitespace-only strings', () => {
      expect(() => validateNonEmptyString('')).toThrow(TurnstileError);
      expect(() => validateNonEmptyString('   ')).toThrow(TurnstileError);

      const error = getErrorFromValidation(() => validateNonEmptyString(''));
      expect(error.code).toBe(ErrorCode.VALIDATION_REQUIRED);
    });
  });

  describe('validateDefined', () => {
    it('should validate defined values', () => {
      expect(validateDefined(0)).toBe(0);
      expect(validateDefined('')).toBe('');
      expect(validateDefined(false)).toBe(false);
      expect(validateDefined({})).toEqual({});
    });

    it('should throw for null or undefined', () => {
      expect(() => validateDefined(null)).toThrow(TurnstileError);
      expect(() => validateDefined(undefined)).toThrow(TurnstileError);

      const error = getErrorFromValidation(() => validateDefined(null));
      expect(error.code).toBe(ErrorCode.VALIDATION_REQUIRED);
      expect(error.context.issue).toBe('Value is null or undefined');
    });
  });
});

describe('Predicates', () => {
  describe('isPositive', () => {
    it('should return true for positive BigInt values', () => {
      expect(predicates.isPositive(1n)).toBe(true);
      expect(predicates.isPositive(100n)).toBe(true);
    });

    it('should return false for zero or negative BigInt values', () => {
      expect(predicates.isPositive(0n)).toBe(false);
      expect(predicates.isPositive(-1n)).toBe(false);
    });
  });

  describe('isInRange', () => {
    it('should create a predicate that checks if a number is within range', () => {
      const checkRange = predicates.isInRange(5, 10);
      expect(checkRange(5)).toBe(true); // Min value
      expect(checkRange(7)).toBe(true); // Middle value
      expect(checkRange(10)).toBe(true); // Max value
      expect(checkRange(4)).toBe(false); // Below min
      expect(checkRange(11)).toBe(false); // Above max
    });
  });

  describe('isNotEmpty', () => {
    it('should return true for non-empty strings', () => {
      expect(predicates.isNotEmpty('test')).toBe(true);
      expect(predicates.isNotEmpty(' test ')).toBe(true);
    });

    it('should return false for empty or whitespace-only strings', () => {
      expect(predicates.isNotEmpty('')).toBe(false);
      expect(predicates.isNotEmpty('   ')).toBe(false);
    });
  });

  describe('matchesPattern', () => {
    it('should create a predicate that checks if a string matches a pattern', () => {
      const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      const isEmail = predicates.matchesPattern(emailPattern);

      expect(isEmail('test@example.com')).toBe(true);
      expect(isEmail('invalid')).toBe(false);
      expect(isEmail('invalid@')).toBe(false);
    });
  });

  describe('hasLength', () => {
    it('should create a predicate that checks if an array has specific length', () => {
      const hasThreeItems = predicates.hasLength(3);

      expect(hasThreeItems([1, 2, 3])).toBe(true);
      expect(hasThreeItems([1, 2])).toBe(false);
      expect(hasThreeItems([1, 2, 3, 4])).toBe(false);
    });
  });

  describe('isDefined', () => {
    it('should be a type guard for non-null and non-undefined values', () => {
      expect(predicates.isDefined(0)).toBe(true);
      expect(predicates.isDefined('')).toBe(true);
      expect(predicates.isDefined(false)).toBe(true);
      expect(predicates.isDefined({})).toBe(true);
      expect(predicates.isDefined(null)).toBe(false);
      expect(predicates.isDefined(undefined)).toBe(false);
    });
  });

  describe('Predicate combinators', () => {
    it('should support negation with "not"', () => {
      const isPositive = (n: number) => n > 0;
      const isNotPositive = predicates.not(isPositive);

      expect(isNotPositive(1)).toBe(false);
      expect(isNotPositive(0)).toBe(true);
      expect(isNotPositive(-1)).toBe(true);
    });

    it('should support conjunction with "and"', () => {
      const isPositive = (n: number) => n > 0;
      const isLessThan10 = (n: number) => n < 10;
      const isBetween0And10 = predicates.and(isPositive, isLessThan10);

      expect(isBetween0And10(5)).toBe(true);
      expect(isBetween0And10(0)).toBe(false);
      expect(isBetween0And10(10)).toBe(false);
    });

    it('should support disjunction with "or"', () => {
      const isLessThan0 = (n: number) => n < 0;
      const isGreaterThan10 = (n: number) => n > 10;
      const isOutsideRange = predicates.or(isLessThan0, isGreaterThan10);

      expect(isOutsideRange(-5)).toBe(true);
      expect(isOutsideRange(15)).toBe(true);
      expect(isOutsideRange(5)).toBe(false);
    });

    it('should support complex combinations', () => {
      const isEven = (n: number) => n % 2 === 0;
      const isPositive = (n: number) => n > 0;
      const isLessThan100 = (n: number) => n < 100;

      // Actually want: (isEven AND isPositive AND isLessThan100) OR (isLessThan100)
      // Which simplifies to just: isLessThan100
      // So let's test a more complex predicate:

      // (isEven AND isPositive) AND NOT(isLessThan100)
      // This will match even positive numbers that are >= 100
      const complexPredicate = predicates.and(predicates.and(isEven, isPositive), predicates.not(isLessThan100));

      expect(complexPredicate(2)).toBe(false); // Even and positive but < 100
      expect(complexPredicate(3)).toBe(false); // Not even, positive, but < 100
      expect(complexPredicate(50)).toBe(false); // Even, positive, but < 100
      expect(complexPredicate(100)).toBe(true); // Even, positive, and == 100
      expect(complexPredicate(200)).toBe(true); // Even, positive, and > 100
      expect(complexPredicate(-200)).toBe(false); // Even, not positive, > 100
    });
  });
});

// Helper function to extract error from a validation
function getErrorFromValidation(validationFn: () => void): TurnstileError {
  try {
    validationFn();
    throw new Error('Expected validation to fail');
  } catch (error) {
    if (error instanceof TurnstileError) {
      return error;
    }
    throw new Error('Expected TurnstileError but got a different error');
  }
}
