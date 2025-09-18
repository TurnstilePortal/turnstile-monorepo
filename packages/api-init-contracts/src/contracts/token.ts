import { type ContractClassWithId, getContractClassFromArtifact } from '@aztec/aztec.js';
import { TokenContractArtifact } from '@turnstile-portal/aztec-artifacts';
import type { ContractHelper } from './index.js';

export async function getTokenContractClass(): Promise<ContractClassWithId> {
  const contractClass = await getContractClassFromArtifact(TokenContractArtifact);
  return contractClass;
}

export const tokenHelper: ContractHelper = {
  name: 'Token',
  getContractClass: getTokenContractClass,
  getArtifact: () => Promise.resolve(TokenContractArtifact),
  // No instance methods - this contract is artifact-only
};
