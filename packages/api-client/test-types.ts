// Test file to verify deployment_params types are working correctly
import type { ContractInstance } from './src/index.js';

// This should compile without errors, demonstrating the types work correctly
const _testContractInstance: ContractInstance = {
  address: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  original_contract_class_id: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  current_contract_class_id: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  initialization_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  deployment_params: {
    constructorArtifact: 'constructor_with_minter',
    constructorArgs: [42, 'test'],
    salt: '0xabcdef1234567890',
    publicKeys: '0x1234567890abcdef',
    deployer: '0xabcdef1234567890',
  },
  version: 1,
};

// Test that deployment_params can be null
const _testContractInstanceWithNullParams: ContractInstance = {
  address: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  original_contract_class_id: null,
  current_contract_class_id: null,
  initialization_hash: null,
  deployment_params: null,
  version: 1,
};

console.log('Types test passed!');
