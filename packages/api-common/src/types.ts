export type ContractInstantiationData = {
  constructorArtifact?: string | null; // e.g., 'constructor_with_minter'
  constructorArgs?: unknown[] | null;
  salt: `0x${string}`; // Fr.toString()
  publicKeys: `0x${string}`; // PublicKeys.toString()
  deployer: `0x${string}`; // AztecAddress
};
