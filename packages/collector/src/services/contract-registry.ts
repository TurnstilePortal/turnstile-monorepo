import {
  AztecAddress,
  type ContractInstanceWithAddress,
  encodeArguments,
  getContractInstanceFromInstantiationParams,
} from '@aztec/aztec.js';
import { PublicKeys } from '@aztec/stdlib/keys';
import {
  AztecArtifactsApiClient,
  createDefaultClient,
  getFunctionAbi,
  type InitializationData,
} from '@aztec-artifacts/client';
import { TokenContractArtifact } from '@turnstile-portal/aztec-artifacts';
import { L2_CONTRACT_DEPLOYMENT_SALT } from '@turnstile-portal/turnstile.js';
import { logger } from '../utils/logger.js';

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
}

const tokenConstructorName = 'constructor_with_minter';
const tokenConstructorAbi = getFunctionAbi(TokenContractArtifact, tokenConstructorName);

export class ContractRegistryService {
  private artifactsClientPromise: AztecArtifactsApiClient;

  constructor(artifactsApiUrl?: string) {
    if (artifactsApiUrl) {
      logger.info(`Using Aztec Artifacts API at ${artifactsApiUrl}`);
      this.artifactsClientPromise = new AztecArtifactsApiClient({ baseUrl: artifactsApiUrl });
    } else {
      logger.info('Using default Aztec Artifacts API URL');
      this.artifactsClientPromise = createDefaultClient();
    }
  }

  private async getArtifactsClient(): Promise<AztecArtifactsApiClient> {
    return this.artifactsClientPromise;
  }

  /**
   * Derive a token contract instance from deployment parameters
   */
  private async deriveTokenContractInstanceAndInitData(
    name: string,
    symbol: string,
    decimals: number,
    portalAddress: AztecAddress,
    publicKeys: PublicKeys,
  ): Promise<{ instance: ContractInstanceWithAddress; initData: InitializationData }> {
    const instance = await getContractInstanceFromInstantiationParams(TokenContractArtifact, {
      constructorArtifact: tokenConstructorAbi,
      constructorArgs: [name, symbol, decimals, portalAddress, AztecAddress.ZERO /* upgrade_authority */],
      salt: L2_CONTRACT_DEPLOYMENT_SALT,
      deployer: AztecAddress.ZERO,
      publicKeys,
    });

    const encodedArgs = encodeArguments(tokenConstructorAbi, [
      name,
      symbol,
      decimals,
      portalAddress,
      AztecAddress.ZERO,
    ]);

    return { instance, initData: { constructorName: tokenConstructorName, encodedArgs } };
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
      const { instance, initData } = await this.deriveTokenContractInstanceAndInitData(
        metadata.name,
        metadata.symbol,
        metadata.decimals,
        portalAddress,
        PublicKeys.default(),
      );

      // Verify the address matches
      if (!instance.address.equals(tokenAddress)) {
        logger.warn(
          `Token address mismatch: calculated ${instance.address.toString()}, expected ${tokenAddress.toString()}`,
        );
        return;
      }

      const client = await this.getArtifactsClient();

      await client.uploadContractInstance({
        instance,
        initializationData: initData,
        artifact: TokenContractArtifact,
      });

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
