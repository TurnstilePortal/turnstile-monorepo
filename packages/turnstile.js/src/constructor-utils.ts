/**
 * Utility functions to simplify common setup patterns
 */

/**
 * Type for objects with an account property
 */
export interface WithAccount {
  account: unknown;
}

/**
 * Validates and prepares wallet client for transactions
 * @param walletClient The wallet client
 * @param errorConstructor Constructor for the error to throw
 * @param errorMessage Message for the error
 * @returns The validated wallet client with account
 */
export function validateWalletClient<
  T extends Partial<WithAccount>,
  E extends Error,
>(
  walletClient: T,
  errorConstructor: new (message: string) => E,
  errorMessage: string,
): T {
  if (!walletClient || !walletClient.account) {
    throw new errorConstructor(errorMessage);
  }
  return walletClient;
}

/**
 * Returns a standard error handling function for token operations
 * @param errorConstructor Constructor for the error to throw
 * @param errorMessageFn Function that generates error message
 * @returns Error handler function
 */
export function createTokenErrorHandler<
  ErrorClass extends abstract new (
    ...args: unknown[]
  ) => Error,
  Args extends unknown[],
>(
  errorConstructor: new (
    message: string,
    cause?: unknown,
  ) => InstanceType<ErrorClass>,
  errorMessageFn: (...args: Args) => string,
): (error: unknown, ...args: Args) => never {
  return (error: unknown, ...args: Args): never => {
    throw new errorConstructor(errorMessageFn(...args), error);
  };
}

/**
 * Creates a function to check if a wallet has a connected account
 * @param errorConstructor Constructor for the error to throw
 * @param errorMessage Message if no account is connected
 * @returns Function that throws if no account is connected
 */
export function createAccountChecker<E extends Error>(
  errorConstructor: new (message: string) => E,
  errorMessage: string,
): (obj: Partial<WithAccount>) => void {
  return (obj: Partial<WithAccount>): void => {
    if (!obj || !obj.account) {
      throw new errorConstructor(errorMessage);
    }
  };
}

/**
 * Helper function to safely extract properties from an object
 * @param obj Object to extract from
 * @param propName Property name to extract
 * @param defaultValue Default value if property doesn't exist
 * @returns The extracted property or default value
 */
export function safeGet<T extends Record<string, unknown>, K extends keyof T>(
  obj: T | null | undefined,
  propName: K,
  defaultValue: T[K],
): T[K] {
  return obj && typeof obj === 'object' && propName in obj
    ? obj[propName]
    : defaultValue;
}
