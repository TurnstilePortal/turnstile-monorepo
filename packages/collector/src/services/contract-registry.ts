import { AztecAddress, getContractClassFromArtifact, getContractInstanceFromDeployParams } from '@aztec/aztec.js';
import { PublicKeys } from '@aztec/stdlib/keys';
import type { ContractInstantiationData } from '@turnstile-portal/api-common';
import type { NewContractInstance } from '@turnstile-portal/api-common/schema';
import { TokenContractArtifact } from '@turnstile-portal/aztec-artifacts';
import { L2_CONTRACT_DEPLOYMENT_SALT } from '@turnstile-portal/turnstile.js';
import { getContractInstanceByAddress, getOrCreateTokenContractArtifact, storeContractInstance } from '../db.js';
import { logger } from '../utils/logger.js';

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
}

export class ContractRegistryService {
  private tokenContractClass: { id: string; artifactHash: string } | null = null;

  /**
   * Calculate and cache the token contract class
   */
  private async getTokenContractClass(): Promise<{ id: string; artifactHash: string }> {
    if (!this.tokenContractClass) {
      const contractClass = await getContractClassFromArtifact(TokenContractArtifact);
      this.tokenContractClass = {
        id: contractClass.id.toString(),
        artifactHash: contractClass.artifactHash.toString(),
      };
      logger.debug(`Calculated token contract class ID: ${this.tokenContractClass.id}`);
    }
    return this.tokenContractClass;
  }

  /**
   * Derive a token contract instance from deployment parameters
   */
  private async deriveTokenContractInstance(
    name: string,
    symbol: string,
    decimals: number,
    portalAddress: AztecAddress,
    publicKeys: PublicKeys,
  ) {
    const instance = await getContractInstanceFromDeployParams(TokenContractArtifact, {
      constructorArtifact: 'constructor_with_minter',
      constructorArgs: [name, symbol, decimals, portalAddress, AztecAddress.ZERO /* upgrade_authority */],
      salt: L2_CONTRACT_DEPLOYMENT_SALT,
      deployer: AztecAddress.ZERO,
      publicKeys,
    });

    return instance;
  }

  /**
   * Ensure the TokenContractArtifact exists in the database
   */
  private async ensureTokenArtifact(): Promise<void> {
    const contractClass = await this.getTokenContractClass();
    await getOrCreateTokenContractArtifact(contractClass.artifactHash, contractClass.id, TokenContractArtifact);
  }

  /**
   * Store a token contract instance in the database
   */
  async storeTokenInstance(
    tokenAddress: AztecAddress,
    portalAddress: AztecAddress,
    metadata: TokenMetadata,
  ): Promise<void> {
    try {
      // Check if instance already exists
      const existing = await getContractInstanceByAddress(tokenAddress.toString());
      if (existing) {
        logger.debug(`Contract instance already exists for address: ${tokenAddress.toString()}`);
        return;
      }

      // Ensure the token artifact exists
      await this.ensureTokenArtifact();

      // Get contract class
      const contractClass = await this.getTokenContractClass();
      const contractClassId = contractClass.id;

      // Derive the contract instance
      const publicKeys = PublicKeys.default();
      const instance = await this.deriveTokenContractInstance(
        metadata.name,
        metadata.symbol,
        metadata.decimals,
        portalAddress,
        publicKeys,
      );

      // Verify the address matches
      if (!instance.address.equals(tokenAddress)) {
        logger.warn(
          `Token address mismatch: calculated ${instance.address.toString()}, expected ${tokenAddress.toString()}`,
        );
        return;
      }

      // Prepare deployment parameters for storage
      const deploymentParams: ContractInstantiationData = {
        constructorArtifact: 'constructor_with_minter',
        constructorArgs: [
          metadata.name,
          metadata.symbol,
          metadata.decimals,
          portalAddress.toString(),
          AztecAddress.ZERO.toString(),
        ],
        salt: L2_CONTRACT_DEPLOYMENT_SALT.toString() as `0x${string}`,
        publicKeys: publicKeys.toString() as `0x${string}`,
        deployer: AztecAddress.ZERO.toString() as `0x${string}`,
      };

      // Create contract instance record
      const newInstance: NewContractInstance = {
        address: tokenAddress.toString(),
        originalContractClassId: contractClassId,
        currentContractClassId: contractClassId,
        initializationHash: instance.initializationHash?.toString() ?? null,
        deploymentParams,
        version: instance.version,
      };

      await storeContractInstance(newInstance);
      logger.info(`Stored contract instance for token ${tokenAddress.toString()}`);
    } catch (error) {
      logger.error(
        { error, tokenAddress: tokenAddress.toString(), portalAddress: portalAddress.toString() },
        'Failed to store token contract instance',
      );
      throw error;
    }
  }
}
