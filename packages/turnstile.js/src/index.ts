// Error handling
export * from './errors.js';

// Validation utilities
export * from './validator.js';

// L1 (Ethereum) components
export * from './l1/client.js';
export * from './l1/token.js';
export * from './l1/portal.js';
export * from './l1/allowList.js';

// L2 (Aztec) components
export * from './l2/client.js';
export * from './l2/token.js';
export * from './l2/portal.js';
export { getFeeJuiceFromFaucet } from './l2/fee-utils.js';
