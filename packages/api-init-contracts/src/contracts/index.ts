import type { ContractArtifact, ContractClassWithId, ContractInstanceWithAddress } from '@aztec/aztec.js';
import type { ContractInstantiationData } from '@turnstile-portal/api-common';

/**
 * Interface for contract helpers that provide unified access to contract data.
 * Some contracts only need artifacts (like Token), while others also have instances.
 */
export interface ContractHelper {
  /** Human-readable name of the contract */
  name: string;

  /** Get the contract class with ID */
  getContractClass(): Promise<ContractClassWithId>;

  /** Get the contract artifact */
  getArtifact(): Promise<ContractArtifact>;

  /** Get the contract instance (optional - only for deployed contracts) */
  getContractInstance?(): Promise<ContractInstanceWithAddress>;

  /** Get deployment parameters (optional - only for deployed contracts) */
  getDeploymentParams?(): Promise<ContractInstantiationData>;
}

// Re-export all helpers
export { portalHelper } from './portal.js';
export { shieldGatewayHelper } from './shield-gateway.js';
export { tokenHelper } from './token.js';
