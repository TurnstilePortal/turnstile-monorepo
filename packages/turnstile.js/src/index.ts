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

// Legacy aliases for backward compatibility with examples
import { L1Portal } from './l1/portal.js';
import { L2Portal } from './l2/portal.js';

// Provide legacy class names for backward compatibility
export const L1TokenPortal = L1Portal;
export const AztecTokenPortal = L2Portal;
