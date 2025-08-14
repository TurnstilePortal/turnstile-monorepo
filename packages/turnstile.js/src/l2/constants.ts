import { Fr } from '@aztec/aztec.js';

/**
 * Virtual Proof slot identifier used for proof verification
 *
 * This hexadecimal value (0x1dfeed) serves as a unique identifier for
 * virtual proof slots in the Aztec protocol verification system.
 */
export const VP_SLOT = Fr.fromHexString('0x1dfeed');

/**
 * Deterministic salt for L2 contract deployments
 *
 * This fixed salt value (0x9876543210) ensures deterministic addresses
 * for deployed L2 contracts across different environments. Used in
 * conjunction with contract artifacts to compute predictable contract addresses.
 */
export const L2_CONTRACT_DEPLOYMENT_SALT = Fr.fromHexString('0x9876543210');

/**
 * Function selector for the withdraw operation
 *
 * This is the Keccak256 hash truncated to 4 bytes for the function signature:
 * `withdraw(address,address,uint256)` - representing (token, recipient, amount)
 * Used to identify withdraw calls in transaction data and event logs.
 */
export const WITHDRAW_SELECTOR = '0xd9caed12'; // withdraw(address,address,uint256)

/**
 * Public secret for L1 to L2 message authentication
 *
 * This "not-secret" value (0x7075626c6963, ASCII for "public") is used
 * as a known secret for L1 to L2 message passing in the Aztec protocol.
 * It's intentionally public to allow transparent cross-layer communication
 * while maintaining the message authentication interface.
 */
export const PUBLIC_NOT_SECRET_SECRET = Fr.fromHexString('0x7075626c6963');
