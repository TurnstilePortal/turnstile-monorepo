import {
  AztecAddress,
  getContractInstanceFromDeployParams,
} from '@aztec/aztec.js';
import { PublicKeys } from '@aztec/stdlib/keys';

import { ShieldGatewayContractArtifact } from '@turnstile-portal/aztec-artifacts';
import type { IL2Client } from './client.js';
import { L2_CONTRACT_DEPLOYMENT_SALT } from './constants.js';

/**
 * Registers a Shield Gateway contract instance in the Private Execution Environment (PXE)
 *
 * This function creates a contract instance from deployment parameters and registers it
 * with the client's wallet to enable contract interactions. The Shield Gateway is responsible
 * for authorizing private token transfers between different addresses.
 *
 * @param client The L2 client containing the wallet to register the contract with
 * @param shieldGatewayAddress The expected address of the deployed Shield Gateway contract
 * @returns Promise resolving to the registered contract instance
 * @throws Error if the computed address doesn't match the expected address
 */
export async function registerShieldGatewayInPXE(
  client: IL2Client,
  shieldGatewayAddress: AztecAddress,
) {
  const instance = await getContractInstanceFromDeployParams(
    ShieldGatewayContractArtifact,
    {
      salt: L2_CONTRACT_DEPLOYMENT_SALT,
      deployer: AztecAddress.ZERO,
      publicKeys: PublicKeys.default(),
    },
  );
  if (!instance.address.equals(shieldGatewayAddress)) {
    throw new Error(
      `Deployed ShieldGateway address ${instance.address.toString()} does not match expected address ${shieldGatewayAddress.toString()}`,
    );
  }
  console.debug(
    `Registering ShieldGateway in PXE: ${shieldGatewayAddress.toString()}`,
  );
  await client
    .getWallet()
    .registerContract({ instance, artifact: ShieldGatewayContractArtifact });
  return instance;
}
